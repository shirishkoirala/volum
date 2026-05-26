package api

import (
	"net/http"
	"time"
)

func (s *Server) handleVacuum(w http.ResponseWriter, r *http.Request) {
	if err := s.jobs.Vacuum(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handlePruneJobs(w http.ResponseWriter, r *http.Request) {
	olderThan := 7 * 24 * time.Hour
	if val := r.URL.Query().Get("olderThan"); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			olderThan = d
		}
	}
	removed, err := s.jobs.PruneJobs(r.Context(), olderThan)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"removed": removed})
}

func (s *Server) handlePruneAuditLogs(w http.ResponseWriter, r *http.Request) {
	olderThan := 30 * 24 * time.Hour
	if val := r.URL.Query().Get("olderThan"); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			olderThan = d
		}
	}
	removed, err := s.jobs.PruneAuditLogs(r.Context(), olderThan)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"removed": removed})
}
