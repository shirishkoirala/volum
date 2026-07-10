package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func (s *Server) handleUploadStatus(w http.ResponseWriter, r *http.Request) {
	targetPublic := r.URL.Query().Get("path")
	filename := r.URL.Query().Get("filename")

	if !validUploadName(filename) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid filename"})
		return
	}

	targetDir, err := s.guard.Resolve(targetPublic)
	if err != nil {
		writeError(w, err)
		return
	}

	partialPath := filepath.Join(targetDir, ".volum-tmp", filename+".partial")
	jobIDPath := filepath.Join(targetDir, ".volum-tmp", filename+".jobid")

	var received int64
	if fi, err := os.Stat(partialPath); err == nil {
		received = fi.Size()
	}

	jobID := ""
	if data, err := os.ReadFile(jobIDPath); err == nil {
		jobID = strings.TrimSpace(string(data))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"filename": filename,
		"received": received,
		"complete": false,
		"jobId":    jobID,
	})
}

func (s *Server) handleUploadChunk(w http.ResponseWriter, r *http.Request) {
	targetPublic := r.URL.Query().Get("path")
	filename := r.URL.Query().Get("filename")
	offsetStr := r.URL.Query().Get("offset")
	totalSizeStr := r.URL.Query().Get("totalSize")
	jobID := r.URL.Query().Get("jobId")

	offset, err := strconv.ParseInt(offsetStr, 10, 64)
	if err != nil || offset < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid offset"})
		return
	}
	totalSize, err := strconv.ParseInt(totalSizeStr, 10, 64)
	if err != nil || totalSize <= 0 || totalSize > maxAggregateUploadBytes {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid totalSize"})
		return
	}
	if offset > totalSize {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "offset exceeds totalSize"})
		return
	}

	if !validUploadName(filename) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid filename"})
		return
	}

	targetDir, err := s.guard.Resolve(targetPublic)
	if err != nil {
		writeError(w, err)
		return
	}
	info, err := os.Stat(targetDir)
	if err != nil {
		writeError(w, err)
		return
	}
	if !info.IsDir() {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload target must be a directory"})
		return
	}

	chunkData, err := io.ReadAll(io.LimitReader(r.Body, maxUploadChunkBytes+1))
	if err != nil {
		writeError(w, err)
		return
	}
	if int64(len(chunkData)) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "empty chunk"})
		return
	}
	if int64(len(chunkData)) > maxUploadChunkBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "upload chunk is too large"})
		return
	}
	if offset+int64(len(chunkData)) > totalSize {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chunk exceeds totalSize"})
		return
	}

	destinationPublic := filepath.Join(filepath.Clean(targetPublic), filename)
	destination, err := s.guard.Resolve(destinationPublic)
	if err != nil {
		writeError(w, err)
		return
	}
	if filepath.Dir(destination) != targetDir {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "path traversal"})
		return
	}

	tempDir := filepath.Join(targetDir, ".volum-tmp")
	partialPath := filepath.Join(tempDir, filename+".partial")
	jobIDPath := filepath.Join(tempDir, filename+".jobid")
	ctx := r.Context()
	itemID := ""

	// Check cancel/pause for existing job
	if jobID != "" {
		cancelled, err := s.jobs.IsCancelled(ctx, jobID)
		if err != nil {
			writeError(w, err)
			return
		}
		if cancelled {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			writeJSON(w, http.StatusGone, map[string]string{"error": "upload cancelled"})
			return
		}
		paused, err := s.jobs.IsPaused(ctx, jobID)
		if err != nil {
			writeError(w, err)
			return
		}
		if paused {
			writeJSON(w, http.StatusConflict, map[string]any{"error": "upload paused", "paused": true})
			return
		}
	}

	// Write chunk to temp file
	if err := s.guard.MkdirAll(tempDir, 0o755); err != nil {
		writeError(w, err)
		return
	}
	f, err := s.guard.OpenFile(partialPath, os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		writeError(w, err)
		return
	}

	n, err := f.WriteAt(chunkData, offset)
	if err != nil {
		f.Close()
		writeError(w, err)
		return
	}
	_ = f.Sync()
	f.Close()

	received := offset + int64(n)
	complete := received >= totalSize

	// First chunk: create job
	if jobID == "" {
		job, err := s.jobs.Create(ctx, jobs.CreateRequest{
			Type:            jobs.TypeUpload,
			SourcePath:      filename,
			DestinationPath: destinationPublic,
			ConflictPolicy:  uploadConflictPolicy(r),
			VerifyMode:      "size",
		})
		if err != nil {
			s.cleanupUploadPaths(partialPath)
			writeError(w, err)
			return
		}
		jobID = job.ID
		if err := s.writeUploadState(jobIDPath, []byte(jobID)); err != nil {
			s.cleanupUploadPaths(partialPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		if err := s.jobs.StartJob(ctx, job.ID); err != nil {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		if err := s.jobs.SetJobTotals(ctx, job.ID, totalSize, 1); err != nil {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		item, err := s.jobs.CreateItem(ctx, jobs.Item{
			JobID:           job.ID,
			SourcePath:      filename,
			DestinationPath: destination,
			SizeBytes:       totalSize,
			Status:          jobs.StatusRunning,
			ProcessedBytes:  received,
		})
		if err != nil {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		itemID = item.ID
		if err := s.jobs.UpdateJobProgress(ctx, job.ID, received, 0, filename); err != nil {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
	} else {
		if err := s.jobs.UpdateJobProgress(ctx, jobID, received, 0, filename); err != nil {
			writeError(w, err)
			return
		}
	}

	// Last chunk: finalize
	if complete {
		if itemID == "" {
			items, err := s.jobs.ListItems(ctx, jobID)
			if err != nil {
				s.cleanupUploadPaths(partialPath)
				s.cleanupUploadPaths(jobIDPath)
				_ = s.jobs.FailJob(ctx, jobID, err)
				writeError(w, err)
				return
			}
			if len(items) > 0 {
				itemID = items[0].ID
			}
		}
		if fi, err := os.Stat(partialPath); err != nil || fi.Size() != totalSize {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			_ = s.jobs.FailJob(ctx, jobID, fmt.Errorf("upload verification failed: size mismatch"))
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "upload verification failed: size mismatch"})
			return
		}

		job, err := s.finalizeUpload(ctx, uploadFinalizeRequest{
			jobID:             jobID,
			itemID:            itemID,
			tempPath:          partialPath,
			destination:       destination,
			destinationPublic: destinationPublic,
			uploadName:        filename,
			name:              filename,
			bytes:             totalSize,
			conflictPolicy:    uploadConflictPolicy(r),
			cleanupPaths:      []string{jobIDPath},
		})
		if err != nil {
			s.cleanupUploadPaths(partialPath)
			s.cleanupUploadPaths(jobIDPath)
			_ = s.jobs.FailJob(ctx, jobID, err)
			writeError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"received": received,
			"complete": true,
			"jobId":    jobID,
			"job":      job,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"received": received,
		"complete": false,
		"jobId":    jobID,
	})
}
