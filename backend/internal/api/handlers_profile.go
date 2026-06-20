package api

import (
	"bytes"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"

	"github.com/volum-app/volum/backend/internal/auth"
)

const (
	maxAvatarBytes     = 2 << 20
	maxAvatarDimension = 4096
)

func (s *Server) handleGetAvatar(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserFromContext(r.Context())
	avatar, err := s.authStore.GetAvatar(r.Context(), user.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	if avatar == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "profile image not found"})
		return
	}

	w.Header().Set("Content-Type", avatar.MIME)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(avatar.Data)
}

func (s *Server) handleUpdateAvatar(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarBytes+(64<<10))
	if err := r.ParseMultipartForm(maxAvatarBytes); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "profile image must be 2 MB or smaller"})
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid profile image upload"})
		}
		return
	}
	file, _, err := r.FormFile("avatar")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "profile image is required"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxAvatarBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "could not read profile image"})
		return
	}
	if len(data) == 0 || len(data) > maxAvatarBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "profile image must be 2 MB or smaller"})
		return
	}

	mime := http.DetectContentType(data)
	if mime != "image/png" && mime != "image/jpeg" {
		writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "profile image must be a PNG or JPEG"})
		return
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > maxAvatarDimension || config.Height > maxAvatarDimension {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "profile image is invalid or exceeds 4096 pixels"})
		return
	}

	user, _ := auth.UserFromContext(r.Context())
	updatedAt, err := s.authStore.UpdateAvatar(r.Context(), user.ID, data, mime)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"hasAvatar":     true,
		"avatarVersion": updatedAt.UnixMilli(),
	})
}

func (s *Server) handleDeleteAvatar(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserFromContext(r.Context())
	updatedAt, err := s.authStore.DeleteAvatar(r.Context(), user.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"hasAvatar":     false,
		"avatarVersion": updatedAt.UnixMilli(),
	})
}
