package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/desktop"
)

func (s *Server) handleListServices(w http.ResponseWriter, r *http.Request) {
	services, err := s.desktop.ListServices(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if services == nil {
		services = []desktop.ServiceRecord{}
	}
	writeJSON(w, http.StatusOK, services)
}

func (s *Server) handleCreateService(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		IconURL     string `json:"iconUrl,omitempty"`
		HealthURL   string `json:"healthUrl,omitempty"`
		Description string `json:"description,omitempty"`
		OpenMode    string `json:"openMode,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Name == "" || req.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and url are required"})
		return
	}
	svc, err := s.desktop.CreateService(r.Context(), req.Name, req.URL, req.IconURL, req.HealthURL, req.Description, req.OpenMode)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, svc)
}

func (s *Server) handleUpdateService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		IconURL     string `json:"iconUrl,omitempty"`
		HealthURL   string `json:"healthUrl,omitempty"`
		Description string `json:"description,omitempty"`
		OpenMode    string `json:"openMode,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Name == "" || req.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and url are required"})
		return
	}
	svc, err := s.desktop.UpdateService(r.Context(), id, req.Name, req.URL, req.IconURL, req.HealthURL, req.Description, req.OpenMode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "service not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, svc)
}

func (s *Server) handleServiceHealth(w http.ResponseWriter, r *http.Request) {
	results := s.healthChecker.GetCachedResults()
	if results == nil {
		results = make(map[string]desktop.ServiceHealthResult)
	}

	if len(results) == 0 {
		results = s.doLiveHealthChecks(r.Context())
	}

	writeJSON(w, http.StatusOK, results)
}

func (s *Server) doLiveHealthChecks(ctx context.Context) map[string]desktop.ServiceHealthResult {
	services, err := s.desktop.ListServices(ctx)
	if err != nil {
		return make(map[string]desktop.ServiceHealthResult)
	}

	results := make(map[string]desktop.ServiceHealthResult)
	for _, svc := range services {
		if svc.HealthURL == "" {
			continue
		}
		result := s.healthChecker.CheckOne(ctx, svc)
		results[svc.ID] = result
	}
	return results
}

func (s *Server) handleDeleteService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.desktop.DeleteService(r.Context(), id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "service not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleReorderServices(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if err := s.desktop.ReorderServices(r.Context(), req.IDs); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}
