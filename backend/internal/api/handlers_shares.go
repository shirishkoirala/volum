package api

import (
	"encoding/hex"
	"encoding/json"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/shares"
)

const (
	maxShareDownloads = 1_000_000
	shareAccessTTL    = 15 * time.Minute
)

func validShareToken(token string) bool {
	if len(token) != 64 {
		return false
	}
	_, err := hex.DecodeString(token)
	return err == nil
}

func shareAccessCookieName(token string) string {
	return "volum_share_" + token[:16]
}

func (s *Server) handleCreateShare(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	var req shares.CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Path == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "path is required"})
		return
	}
	if _, err := s.guard.Resolve(req.Path); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if req.ExpiresAt != "" {
		if _, err := time.Parse(time.RFC3339, req.ExpiresAt); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid expiresAt format, use RFC3339"})
			return
		}
	}
	if req.MaxDownloads != nil && *req.MaxDownloads < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "maxDownloads must be a positive number"})
		return
	}
	if req.MaxDownloads != nil && *req.MaxDownloads > maxShareDownloads {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "maxDownloads is too large"})
		return
	}
	if len(req.Password) > 72 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "share password must be 72 bytes or fewer"})
		return
	}
	user, _ := auth.UserFromContext(r.Context())
	share, err := s.shares.Create(req, string(user.Role))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, share)
}

func (s *Server) handleListShares(w http.ResponseWriter, r *http.Request) {
	sharesList, err := s.shares.List()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"shares": sharesList})
}

func (s *Server) handleDeleteShare(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.shares.Delete(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handlePublicDownload(w http.ResponseWriter, r *http.Request) {
	sensitiveResponse(w)
	token := chi.URLParam(r, "token")
	if !validShareToken(token) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token is required"})
		return
	}

	share, err := s.shares.GetByToken(token)
	if err != nil {
		writeError(w, err)
		return
	}
	if share == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "share not found"})
		return
	}
	if !share.Enabled {
		writeJSON(w, http.StatusGone, map[string]string{"error": "share has been disabled"})
		return
	}
	if share.ExpiresAt != nil {
		expires, err := time.Parse(time.RFC3339, *share.ExpiresAt)
		if err == nil && now().After(expires) {
			writeJSON(w, http.StatusGone, map[string]string{"error": "share has expired"})
			return
		}
	}
	if share.PasswordHash != "" {
		cookie, err := r.Cookie(shareAccessCookieName(token))
		if err != nil || !shares.VerifyAccessToken(share, cookie.Value, now()) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "password required or incorrect"})
			return
		}
	}

	realPath, err := s.guard.Resolve(share.Path)
	if err != nil {
		writeError(w, err)
		return
	}

	info, err := os.Stat(realPath)
	if err != nil {
		writeError(w, err)
		return
	}

	if info.IsDir() {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "directory sharing not yet supported"})
		return
	}
	disableWriteDeadline(w)

	ok, err := s.shares.ReserveDownload(share.ID, now())
	if err != nil {
		writeError(w, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusGone, map[string]string{"error": "share has reached maximum downloads"})
		return
	}

	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filepath.Base(realPath)}))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, realPath)
}

func (s *Server) handlePublicUnlock(w http.ResponseWriter, r *http.Request) {
	sensitiveResponse(w)
	token := chi.URLParam(r, "token")
	if !validShareToken(token) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid share token"})
		return
	}
	if !s.allowShareUnlock(r, token) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many attempts, try again later"})
		return
	}

	share, err := s.shares.GetByToken(token)
	if err != nil {
		writeError(w, err)
		return
	}
	if share == nil || !share.Enabled {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "share not found"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if !s.shares.VerifyPassword(share, req.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "password required or incorrect"})
		return
	}
	expiresAt := now().Add(shareAccessTTL)
	http.SetCookie(w, &http.Cookie{
		Name:     shareAccessCookieName(token),
		Value:    shares.AccessToken(share, expiresAt),
		Path:     "/api/public/" + token,
		HttpOnly: true,
		Secure:   s.secureCookie(r),
		SameSite: http.SameSiteStrictMode,
		Expires:  expiresAt,
		MaxAge:   int(shareAccessTTL.Seconds()),
	})
	w.WriteHeader(http.StatusNoContent)
}

func now() time.Time {
	return time.Now().UTC()
}
