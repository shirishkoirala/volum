package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAggregateUploadBytes)
	targetPublic := r.URL.Query().Get("path")
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

	reader, err := r.MultipartReader()
	if err != nil {
		if IsMaxBytesError(err) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "upload is too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "expected multipart upload"})
		return
	}

	uploaded := make([]jobs.Job, 0)
	uploadSizes := newUploadSizeQueue()
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			if IsMaxBytesError(err) {
				writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "upload is too large"})
				return
			}
			writeError(w, err)
			return
		}
		if part.FileName() == "" && part.FormName() == "manifest" {
			if err := uploadSizes.Read(part); err != nil {
				part.Close()
				if IsMaxBytesError(err) {
					writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "upload is too large"})
					return
				}
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid upload manifest"})
				return
			}
			part.Close()
			continue
		}
		if part.FileName() == "" {
			part.Close()
			continue
		}

		expectedBytes := uploadSizes.Take(part.FileName())
		job, err := s.uploadPart(r.Context(), targetPublic, targetDir, part, uploadConflictPolicy(r), expectedBytes)
		part.Close()
		if err != nil {
			if IsMaxBytesError(err) {
				writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "upload is too large"})
				return
			}
			writeError(w, err)
			return
		}
		uploaded = append(uploaded, job)
	}

	if len(uploaded) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload requires at least one file"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"jobs": uploaded})
}

func (s *Server) uploadPart(ctx context.Context, targetPublic, targetDir string, part *multipart.Part, conflictPolicy string, expectedBytes int64) (jobs.Job, error) {
	rawName := filepath.Base(part.FileName())
	if !validUploadName(rawName) {
		return jobs.Job{}, files.ErrInvalidName
	}
	name := strings.TrimSpace(rawName)
	uploadName := name

	destinationPublic := filepath.Join(filepath.Clean(targetPublic), name)
	destination, err := s.guard.Resolve(destinationPublic)
	if err != nil {
		return jobs.Job{}, err
	}
	if filepath.Dir(destination) != targetDir {
		return jobs.Job{}, security.ErrPathTraversal
	}
	destination, err = s.resolveUploadConflict(destination, conflictPolicy)
	if err != nil {
		return jobs.Job{}, err
	}
	if publicPath, err := s.guard.PublicPath(destination); err == nil {
		destinationPublic = publicPath
	}
	name = filepath.Base(destinationPublic)

	job, err := s.jobs.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeUpload,
		SourcePath:      name,
		DestinationPath: destinationPublic,
		ConflictPolicy:  conflictPolicy,
		VerifyMode:      "size",
	})
	if err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.StartJob(ctx, job.ID); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.SetJobTotals(ctx, job.ID, expectedBytes, 1); err != nil {
		return jobs.Job{}, err
	}

	tempPath := filepath.Join(filepath.Dir(destination), ".volum-tmp", filepath.Base(destination)+".partial")
	item, err := s.jobs.CreateItem(ctx, jobs.Item{
		JobID:           job.ID,
		SourcePath:      name,
		DestinationPath: destination,
		TempPath:        &tempPath,
		SizeBytes:       expectedBytes,
		Status:          jobs.StatusQueued,
	})
	if err != nil {
		return jobs.Job{}, err
	}

	if err := s.guard.MkdirAll(filepath.Dir(tempPath), 0o755); err != nil {
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	temp, err := s.guard.OpenFile(tempPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}

	if err := s.jobs.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, 0, nil); err != nil {
		temp.Close()
		_ = s.guard.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}

	buffer := make([]byte, 1024*1024)
	var written int64
	progressThrottle := newUploadProgressThrottle()
	for {
		n, readErr := part.Read(buffer)
		if n > 0 {
			count, writeErr := temp.Write(buffer[:n])
			if writeErr != nil {
				temp.Close()
				s.cleanupUploadPaths(tempPath)
				_ = s.jobs.FailJob(ctx, job.ID, writeErr)
				return jobs.Job{}, writeErr
			}
			if count != n {
				temp.Close()
				s.cleanupUploadPaths(tempPath)
				_ = s.jobs.FailJob(ctx, job.ID, io.ErrShortWrite)
				return jobs.Job{}, io.ErrShortWrite
			}
			written += int64(count)
			if progressThrottle.Ready(written) {
				if err := s.jobs.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, written, nil); err != nil {
					temp.Close()
					s.cleanupUploadPaths(tempPath)
					_ = s.jobs.FailJob(ctx, job.ID, err)
					return jobs.Job{}, err
				}
				if err := s.jobs.UpdateJobProgress(ctx, job.ID, written, 0, name); err != nil {
					temp.Close()
					s.cleanupUploadPaths(tempPath)
					_ = s.jobs.FailJob(ctx, job.ID, err)
					return jobs.Job{}, err
				}
			}
		}
		if errors.Is(readErr, io.EOF) {
			// Flush final progress
			if written != progressThrottle.lastBytes {
				_ = s.jobs.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, written, nil)
				_ = s.jobs.UpdateJobProgress(ctx, job.ID, written, 0, name)
			}
			break
		}
		if readErr != nil {
			temp.Close()
			s.cleanupUploadPaths(tempPath)
			_ = s.jobs.FailJob(ctx, job.ID, readErr)
			return jobs.Job{}, readErr
		}
	}

	if err := temp.Sync(); err != nil {
		temp.Close()
		s.cleanupUploadPaths(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	if err := temp.Close(); err != nil {
		s.cleanupUploadPaths(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	if expectedBytes > 0 && written != expectedBytes {
		err := fmt.Errorf("upload verification failed for %s: expected %d bytes, uploaded %d bytes", name, expectedBytes, written)
		s.cleanupUploadPaths(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	job, err = s.finalizeUpload(ctx, uploadFinalizeRequest{
		jobID:             job.ID,
		itemID:            item.ID,
		tempPath:          tempPath,
		destination:       destination,
		destinationPublic: destinationPublic,
		uploadName:        uploadName,
		name:              name,
		bytes:             written,
		conflictPolicy:    conflictPolicy,
	})
	if err != nil {
		s.cleanupUploadPaths(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	return job, nil
}

type uploadProgressThrottle struct {
	lastBytes int64
	lastTime  time.Time
}

const uploadThrottleMinBytes = 16 * 1024 * 1024
const uploadThrottleInterval = 500 * time.Millisecond

func newUploadProgressThrottle() *uploadProgressThrottle {
	return &uploadProgressThrottle{lastTime: time.Now()}
}

func (t *uploadProgressThrottle) Ready(currentBytes int64) bool {
	if currentBytes-t.lastBytes < uploadThrottleMinBytes && time.Since(t.lastTime) < uploadThrottleInterval {
		return false
	}
	t.lastBytes = currentBytes
	t.lastTime = time.Now()
	return true
}
