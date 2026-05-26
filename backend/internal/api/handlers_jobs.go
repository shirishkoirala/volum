package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/jobs"
)

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	jobs, err := s.jobs.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs})
}

func (s *Server) handleJobEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming is not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	send := func() bool {
		jobs, err := s.jobs.List(r.Context())
		if err != nil {
			_, _ = fmt.Fprintf(w, "event: error\ndata: %q\n\n", err.Error())
			flusher.Flush()
			return false
		}
		payload, err := json.Marshal(map[string]any{"jobs": jobs})
		if err != nil {
			_, _ = fmt.Fprintf(w, "event: error\ndata: %q\n\n", err.Error())
			flusher.Flush()
			return false
		}
		_, _ = fmt.Fprintf(w, "event: jobs\ndata: %s\n\n", payload)
		flusher.Flush()
		return true
	}

	if !send() {
		return
	}
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if !send() {
				return
			}
		}
	}
}

func (s *Server) handleCreateCopyJob(w http.ResponseWriter, r *http.Request) {
	s.handleCreateTransferJob(w, r, jobs.TypeCopy)
}

func (s *Server) handleCreateMoveJob(w http.ResponseWriter, r *http.Request) {
	s.handleCreateTransferJob(w, r, jobs.TypeMove)
}

func (s *Server) handleCreateArchiveJob(w http.ResponseWriter, r *http.Request) {
	s.handleCreateTransferJob(w, r, jobs.TypeArchive)
}

func (s *Server) handleCreateTransferJob(w http.ResponseWriter, r *http.Request, jobType jobs.Type) {
	var req jobs.CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	req.Type = jobType
	source, err := s.guard.Resolve(req.SourcePath)
	if err != nil {
		writeError(w, err)
		return
	}
	if _, err := s.guard.Resolve(req.DestinationPath); err != nil {
		writeError(w, err)
		return
	}
	if jobType == jobs.TypeMove {
		if _, err := os.Stat(source); err != nil {
			writeError(w, err)
			return
		}
	}

	job, err := s.jobs.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}
	if jobType == jobs.TypeMove {
		if err := s.jobs.CreateAuditLog(r.Context(), "move_queued", req.SourcePath, "queued move to "+req.DestinationPath); err != nil {
			writeError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusCreated, job)
}

func (s *Server) handleJob(w http.ResponseWriter, r *http.Request) {
	job, err := s.jobs.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) handleCancelJob(w http.ResponseWriter, r *http.Request) {
	if err := s.jobs.Cancel(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRetryJob(w http.ResponseWriter, r *http.Request) {
	if err := s.jobs.Retry(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRetryItem(w http.ResponseWriter, r *http.Request) {
	if err := s.jobs.RetryItem(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "itemId")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handlePauseJob(w http.ResponseWriter, r *http.Request) {
	if err := s.jobs.PauseJob(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleResumeJob(w http.ResponseWriter, r *http.Request) {
	if err := s.jobs.ResumeJob(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleClearCompleted(w http.ResponseWriter, r *http.Request) {
	removed, err := s.jobs.ClearCompleted(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"removed": removed})
}

func (s *Server) handleClearFailed(w http.ResponseWriter, r *http.Request) {
	removed, err := s.jobs.ClearFailed(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"removed": removed})
}
