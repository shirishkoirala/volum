package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/jobs"
)

func (s *Server) handleTrash(w http.ResponseWriter, r *http.Request) {
	entries, err := s.files.ListTrash()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleRestoreTrash(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := s.jobs.Create(r.Context(), jobs.CreateRequest{Type: jobs.TypeRestore, SourcePath: id})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, job)
}

func (s *Server) handleDeleteTrash(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.files.DeleteTrash(id); err != nil {
		writeError(w, err)
		return
	}
	if err := s.jobs.CreateAuditLog(r.Context(), "delete", id, "permanently deleted trash item"); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
