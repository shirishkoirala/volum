package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/shares"
)

func (s *Server) handleCreateShare(w http.ResponseWriter, r *http.Request) {
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
	token := chi.URLParam(r, "token")
	if token == "" {
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
	if share.MaxDownloads != nil && share.DownloadCount >= *share.MaxDownloads {
		writeJSON(w, http.StatusGone, map[string]string{"error": "share has reached maximum downloads"})
		return
	}
	if share.PasswordHash != "" {
		password := r.URL.Query().Get("password")
		h := sha256.Sum256([]byte(password))
		if hex.EncodeToString(h[:]) != share.PasswordHash {
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

	if err := s.shares.IncrementDownloadCount(share.ID); err != nil {
		writeError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(realPath)))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, realPath)
}

func now() time.Time {
	return time.Now().UTC()
}
