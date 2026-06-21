package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/volum-app/volum/backend/internal/desktop"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/worker"
)

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	jobs, err := s.jobs.List(r.Context(), limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs})
}

func (s *Server) handleJobEvents(w http.ResponseWriter, r *http.Request) {
	disableWriteDeadline(w)
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming is not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	sendJobs := func() bool {
		jobs, err := s.jobs.List(r.Context(), 200, 0)
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

	sendHealth := func(transition desktop.HealthTransition) bool {
		payload, err := json.Marshal(transition)
		if err != nil {
			return false
		}
		_, _ = fmt.Fprintf(w, "event: health\ndata: %s\n\n", payload)
		flusher.Flush()
		return true
	}

	if !sendJobs() {
		return
	}
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	healthEvents, unsubscribeHealthEvents := s.healthChecker.SubscribeEvents()
	defer unsubscribeHealthEvents()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if !sendJobs() {
				return
			}
		case transition, ok := <-healthEvents:
			if !ok {
				return
			}
			sendHealth(transition)
		}
	}
}

func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var req jobs.CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	switch req.Type {
	case jobs.TypeExtract:
		req.ConflictPolicy = "rename"
		source, err := s.guard.Resolve(req.SourcePath)
		if err != nil {
			writeError(w, err)
			return
		}
		info, err := os.Stat(source)
		if err != nil {
			writeError(w, err)
			return
		}
		if !info.Mode().IsRegular() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "extract source must be a regular file"})
			return
		}
		if worker.ArchiveFormat(req.SourcePath) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported archive format, supported: .zip, .tar, .tar.gz, .tgz"})
			return
		}
		if req.DestinationPath == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "destinationPath is required"})
			return
		}
		if _, err := s.guard.Resolve(req.DestinationPath); err != nil {
			writeError(w, err)
			return
		}

	case jobs.TypeChecksum:
		if req.VerifyMode == "" {
			req.VerifyMode = "sha256"
		}
		if req.VerifyMode != "md5" && req.VerifyMode != "sha256" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "verifyMode must be md5 or sha256"})
			return
		}
		if _, err := s.guard.Resolve(req.SourcePath); err != nil {
			writeError(w, err)
			return
		}

	default:
		source, err := s.guard.Resolve(req.SourcePath)
		if err != nil {
			writeError(w, err)
			return
		}
		if req.DestinationPath != "" {
			if _, err := s.guard.Resolve(req.DestinationPath); err != nil {
				writeError(w, err)
				return
			}
		}
		if req.Type == jobs.TypeMove {
			if _, err := os.Stat(source); err != nil {
				writeError(w, err)
				return
			}
		}
	}

	job, err := s.jobs.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}
	if req.Type == jobs.TypeMove {
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

func (s *Server) handleJobConflicts(w http.ResponseWriter, r *http.Request) {
	items, err := s.jobs.ListConflictingItems(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type resolveRequest struct {
	Items             []resolveItem `json:"items"`
	DefaultResolution *string       `json:"defaultResolution,omitempty"`
}

type resolveItem struct {
	ItemID     string `json:"itemId"`
	Resolution string `json:"resolution"`
}

func (s *Server) handleResolveConflicts(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")

	job, err := s.jobs.Get(r.Context(), jobID)
	if err != nil {
		writeError(w, err)
		return
	}
	if job.Status != jobs.StatusNeedsAttention {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "job is not in needs_attention state"})
		return
	}

	var req resolveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if len(req.Items) == 0 && req.DefaultResolution == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "must provide items or a default resolution"})
		return
	}

	conflicts, err := s.jobs.ListConflictingItems(r.Context(), jobID)
	if err != nil {
		writeError(w, err)
		return
	}
	if len(conflicts) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no conflicting items to resolve"})
		return
	}

	resolutionMap := make(map[string]string, len(req.Items))
	for _, ri := range req.Items {
		switch ri.Resolution {
		case "skip", "overwrite", "rename":
			resolutionMap[ri.ItemID] = ri.Resolution
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("invalid resolution %q for item %s", ri.Resolution, ri.ItemID)})
			return
		}
	}
	if req.DefaultResolution != nil {
		switch *req.DefaultResolution {
		case "skip", "overwrite", "rename":
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("invalid default resolution %q", *req.DefaultResolution)})
			return
		}
	}

	for _, item := range conflicts {
		resolution, ok := resolutionMap[item.ID]
		if !ok {
			if req.DefaultResolution == nil {
				continue
			}
			resolution = *req.DefaultResolution
		}

		switch resolution {
		case "skip":
			if err := s.jobs.UpdateItemConflictResolution(r.Context(), item.ID, "skip"); err != nil {
				writeError(w, err)
				return
			}
			if err := s.jobs.UpdateItemStatus(r.Context(), item.ID, jobs.StatusCompleted, item.SizeBytes, nil); err != nil {
				writeError(w, err)
				return
			}
			details := fmt.Sprintf("conflict resolved: skipped %s", item.SourcePath)
			_ = s.jobs.CreateAuditLog(r.Context(), "conflict_skip", item.SourcePath, details)

		case "overwrite":
			if err := s.guard.RemoveAll(item.DestinationPath); err != nil {
				writeError(w, err)
				return
			}
			_ = s.jobs.UpdateItemStatus(r.Context(), item.ID, jobs.StatusQueued, 0, nil)
			details := fmt.Sprintf("conflict resolved: overwrite %s -> %s", item.SourcePath, item.DestinationPath)
			_ = s.jobs.CreateAuditLog(r.Context(), "conflict_overwrite", item.DestinationPath, details)

		case "rename":
			newDest, err := security.NextAvailablePath(item.DestinationPath)
			if err != nil {
				writeError(w, err)
				return
			}
			_ = s.jobs.UpdateItemDestination(r.Context(), item.ID, newDest)
			_ = s.jobs.UpdateItemStatus(r.Context(), item.ID, jobs.StatusQueued, 0, nil)
			details := fmt.Sprintf("conflict resolved: rename %s -> %s", item.DestinationPath, newDest)
			_ = s.jobs.CreateAuditLog(r.Context(), "conflict_rename", item.SourcePath, details)
		}
	}

	remaining, err := s.jobs.CountConflicts(r.Context(), jobID)
	if err != nil {
		writeError(w, err)
		return
	}

	if remaining == 0 {
		if err := s.jobs.ResumeNeedsAttentionJob(r.Context(), jobID); err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "resolved", "resumed": true})
	} else {
		writeJSON(w, http.StatusOK, map[string]any{"status": "resolved", "resumed": false, "remainingConflicts": remaining})
	}
}
