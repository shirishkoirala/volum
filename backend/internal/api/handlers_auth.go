package api

import (
	"encoding/json"
	"net/http"
	"os"
	"runtime"
	"time"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/devices"
	"github.com/volum-app/volum/backend/internal/version"
)

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	user, ok := s.auth.UserFromRequest(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": ok,
		"role":          user.Role,
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role     auth.Role `json:"role"`
		Password string    `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	token, user, ok := s.auth.Login(req.Role, req.Password)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if s.auth.Enabled() {
		http.SetCookie(w, &http.Cookie{
			Name:     "volum_session",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   60 * 60 * 24 * 7,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": true,
		"role":          user.Role,
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "volum_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
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
