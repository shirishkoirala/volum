package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/auth"
)

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.authStore.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	type userOutput struct {
		ID       string    `json:"id"`
		Username string    `json:"username"`
		Role     auth.Role `json:"role"`
	}
	out := make([]userOutput, 0, len(users))
	for _, u := range users {
		out = append(out, userOutput{ID: u.ID, Username: u.Username, Role: u.Role})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string    `json:"username"`
		Password string    `json:"password"`
		Role     auth.Role `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username and password are required"})
		return
	}
	if req.Role != auth.RoleAdmin && req.Role != auth.RoleReadonly {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role must be 'admin' or 'readonly'"})
		return
	}
	record, err := s.authStore.CreateUser(r.Context(), req.Username, req.Password, req.Role)
	if err != nil {
		if isUniqueConstraint(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "username already exists"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"id": record.ID, "username": record.Username, "role": record.Role,
	})
}

func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	currentUser, _ := auth.UserFromContext(r.Context())
	if currentUser.ID == id {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "cannot delete yourself"})
		return
	}
	if err := s.authStore.DeleteUser(r.Context(), id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "new password is required"})
		return
	}
	if err := s.authStore.UpdatePassword(r.Context(), id, req.NewPassword); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleChangeRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Role auth.Role `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Role != auth.RoleAdmin && req.Role != auth.RoleReadonly {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role must be 'admin' or 'readonly'"})
		return
	}
	currentUser, _ := auth.UserFromContext(r.Context())
	if currentUser.ID == id && req.Role != auth.RoleAdmin {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "cannot demote yourself"})
		return
	}
	if err := s.authStore.UpdateRole(r.Context(), id, req.Role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func isUniqueConstraint(err error) bool {
	return err != nil && (strings.Contains(err.Error(), "UNIQUE constraint") || strings.Contains(err.Error(), "UNIQUE constraint failed"))
}
