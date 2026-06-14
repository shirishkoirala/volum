package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

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

type serviceHealthResult struct {
	ServiceID  string `json:"serviceId"`
	Status     string `json:"status"`
	CheckedAt  string `json:"checkedAt"`
	StatusCode int    `json:"statusCode,omitempty"`
	Error      string `json:"error,omitempty"`
}

func (s *Server) handleServiceHealth(w http.ResponseWriter, r *http.Request) {
	services, err := s.desktop.ListServices(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	results := make(map[string]serviceHealthResult)
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	client := &http.Client{Timeout: 3 * time.Second}

	for _, svc := range services {
		if strings.TrimSpace(svc.HealthURL) == "" {
			continue
		}
		wg.Add(1)
		go func(svc desktop.ServiceRecord) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := checkServiceHealth(r.Context(), client, svc)
			mu.Lock()
			results[svc.ID] = result
			mu.Unlock()
		}(svc)
	}
	wg.Wait()

	writeJSON(w, http.StatusOK, results)
}

func checkServiceHealth(ctx context.Context, client *http.Client, svc desktop.ServiceRecord) serviceHealthResult {
	result := serviceHealthResult{
		ServiceID: svc.ID,
		Status:    "unhealthy",
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, svc.HealthURL, nil)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	resp, err := client.Do(req)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	result.StatusCode = resp.StatusCode
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		result.Status = "healthy"
	}
	return result
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
