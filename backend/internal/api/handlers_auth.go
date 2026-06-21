package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/devices"
	"github.com/volum-app/volum/backend/internal/version"
)

const maxBodyBytes = 1 << 20 // 1 MB limit for request bodies
const minPasswordLen = 12

func validPassword(pw string) bool {
	return len(pw) >= minPasswordLen
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	sensitiveResponse(w)
	user, ok := s.auth.UserFromRequest(r)

	setupRequired := false
	if s.auth.Enabled() {
		req, err := s.auth.SetupRequired(r.Context())
		if err == nil {
			setupRequired = req
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": ok,
		"setupRequired": setupRequired,
		"userId":        user.ID,
		"username":      user.Username,
		"role":          user.Role,
		"hasAvatar":     user.HasAvatar,
		"avatarVersion": user.AvatarVersion,
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	sensitiveResponse(w)
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	var req struct {
		Username   string `json:"username"`
		Password   string `json:"password"`
		RememberMe bool   `json:"rememberMe"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if IsMaxBytesError(err) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "request body too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if !s.allowLogin(r, req.Username) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many requests, try again later"})
		return
	}
	token, user, ok := s.auth.Login(r.Context(), req.Username, req.Password, req.RememberMe)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if s.auth.Enabled() {
		cookie := &http.Cookie{
			Name:     "volum_session",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   s.secureCookie(r),
			SameSite: http.SameSiteLaxMode,
		}
		if req.RememberMe {
			cookie.MaxAge = 60 * 60 * 24 * 7
			cookie.Expires = time.Now().Add(7 * 24 * time.Hour)
		}
		http.SetCookie(w, cookie)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": true,
		"setupRequired": false,
		"userId":        user.ID,
		"username":      user.Username,
		"role":          user.Role,
		"hasAvatar":     user.HasAvatar,
		"avatarVersion": user.AvatarVersion,
	})
}

func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	sensitiveResponse(w)
	if !s.auth.Enabled() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "auth is not enabled"})
		return
	}
	if !s.allowSetup(r) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many requests, try again later"})
		return
	}

	token := strings.TrimSpace(r.Header.Get("X-Bootstrap-Token"))
	if token == "" || !auth.SecureEqual(token, s.bootstrapToken) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "bootstrap token is required or invalid"})
		return
	}

	needed, err := s.auth.SetupRequired(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !needed {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "users already exist"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if IsMaxBytesError(err) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "request body too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username is required"})
		return
	}
	if !validPassword(req.Password) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 12 characters"})
		return
	}
	record, err := s.authStore.CreateInitialAdmin(r.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrSetupComplete) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "users already exist"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	token, user, _ := s.auth.Login(r.Context(), req.Username, req.Password, true)
	if s.auth.Enabled() {
		http.SetCookie(w, &http.Cookie{
			Name:     "volum_session",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   s.secureCookie(r),
			SameSite: http.SameSiteLaxMode,
			MaxAge:   60 * 60 * 24 * 7,
		})
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": true,
		"setupRequired": false,
		"userId":        record.ID,
		"username":      record.Username,
		"role":          auth.RoleAdmin,
		"hasAvatar":     false,
		"avatarVersion": record.UpdatedAt.UnixMilli(),
	})
	_ = user // user is unused for setup response
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	sensitiveResponse(w)
	if user, ok := s.auth.UserFromRequest(r); ok && user.ID != "" {
		_ = s.authStore.BumpSessionVersion(r.Context(), user.ID)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "volum_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   s.secureCookie(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": !s.auth.Enabled(),
		"role":          "",
	})
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"version":   version.Version,
		"buildTime": version.BuildTime,
		"goVersion": runtime.Version(),
	})
}

func (s *Server) handleRoots(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"roots": s.files.RootUsage()})
}

func (s *Server) handleDevices(w http.ResponseWriter, r *http.Request) {
	roots := s.guard.RootEntries()
	devs, err := devices.List(roots)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": devs})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	uptime := int64(time.Since(s.startTime).Seconds())

	var dbSize int64
	if fi, err := os.Stat(s.dbPath); err == nil {
		dbSize = fi.Size()
	}

	active, completed, failed, _ := s.jobs.CountByStatus(r.Context())

	writeJSON(w, http.StatusOK, map[string]any{
		"version":   version.Version,
		"buildTime": version.BuildTime,
		"goVersion": runtime.Version(),
		"uptime":    uptime,
		"dbPath":    s.dbPath,
		"dbSize":    dbSize,
		"roots":     s.files.RootUsage(),
		"jobCounts": map[string]int{
			"active":    active,
			"completed": completed,
			"failed":    failed,
		},
	})
}
