package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

const maxUploadChunkBytes int64 = 2 * 1024 * 1024

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
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
			writeError(w, err)
			return
		}
		if part.FileName() == "" && part.FormName() == "manifest" {
			if err := uploadSizes.Read(part); err != nil {
				part.Close()
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
	destination, err = resolveUploadConflict(destination, conflictPolicy)
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

	if err := os.MkdirAll(filepath.Dir(tempPath), 0o755); err != nil {
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	temp, err := os.OpenFile(tempPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}

	if err := s.jobs.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, 0, nil); err != nil {
		temp.Close()
		_ = os.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}

	buffer := make([]byte, 1024*1024)
	var written int64
	for {
		n, readErr := part.Read(buffer)
		if n > 0 {
			count, writeErr := temp.Write(buffer[:n])
			if writeErr != nil {
				temp.Close()
				_ = os.Remove(tempPath)
				_ = s.jobs.FailJob(ctx, job.ID, writeErr)
				return jobs.Job{}, writeErr
			}
			if count != n {
				temp.Close()
				_ = os.Remove(tempPath)
				_ = s.jobs.FailJob(ctx, job.ID, io.ErrShortWrite)
				return jobs.Job{}, io.ErrShortWrite
			}
			written += int64(count)
			if err := s.jobs.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, written, nil); err != nil {
				temp.Close()
				_ = os.Remove(tempPath)
				_ = s.jobs.FailJob(ctx, job.ID, err)
				return jobs.Job{}, err
			}
			if err := s.jobs.UpdateJobProgress(ctx, job.ID, written, 0, name); err != nil {
				temp.Close()
				_ = os.Remove(tempPath)
				_ = s.jobs.FailJob(ctx, job.ID, err)
				return jobs.Job{}, err
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			temp.Close()
			_ = os.Remove(tempPath)
			_ = s.jobs.FailJob(ctx, job.ID, readErr)
			return jobs.Job{}, readErr
		}
	}

	if err := temp.Sync(); err != nil {
		temp.Close()
		_ = os.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	if err := temp.Close(); err != nil {
		_ = os.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	if expectedBytes > 0 && written != expectedBytes {
		err := fmt.Errorf("upload verification failed for %s: expected %d bytes, uploaded %d bytes", name, expectedBytes, written)
		_ = os.Remove(tempPath)
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
		_ = os.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	return job, nil
}

type uploadFinalizeRequest struct {
	jobID             string
	itemID            string
	tempPath          string
	destination       string
	destinationPublic string
	uploadName        string
	name              string
	bytes             int64
	conflictPolicy    string
	cleanupPaths      []string
}

func (s *Server) finalizeUpload(ctx context.Context, req uploadFinalizeRequest) (jobs.Job, error) {
	destination := req.destination
	destinationPublic := req.destinationPublic
	name := req.name

	finalDestination, err := resolveUploadConflict(destination, req.conflictPolicy)
	if err != nil {
		return jobs.Job{}, err
	}
	if finalDestination != destination {
		destination = finalDestination
		if publicPath, err := s.guard.PublicPath(destination); err == nil {
			destinationPublic = publicPath
		}
		name = filepath.Base(destinationPublic)
	}

	if err := os.Rename(req.tempPath, destination); err != nil {
		return jobs.Job{}, err
	}
	for _, path := range req.cleanupPaths {
		_ = os.Remove(path)
	}
	_ = os.Remove(filepath.Dir(req.tempPath))

	if appBundle, converted, err := s.finalizeAppBundleArchive(destination, req.uploadName, req.conflictPolicy); err != nil {
		return jobs.Job{}, err
	} else if converted {
		destinationPublic = appBundle.publicPath
		name = appBundle.filename
	}

	if name != req.name || destinationPublic != req.destinationPublic {
		if err := s.jobs.UpdateJobPaths(ctx, req.jobID, name, destinationPublic); err != nil {
			return jobs.Job{}, err
		}
	}
	if err := s.jobs.SetJobTotals(ctx, req.jobID, req.bytes, 1); err != nil {
		return jobs.Job{}, err
	}
	if req.itemID != "" {
		if err := s.jobs.UpdateItemStatus(ctx, req.itemID, jobs.StatusCompleted, req.bytes, nil); err != nil {
			return jobs.Job{}, err
		}
	}
	if err := s.jobs.UpdateJobProgress(ctx, req.jobID, req.bytes, 1, name); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.CompleteJob(ctx, req.jobID); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.CreateAuditLog(ctx, "upload", destinationPublic, "uploaded "+name); err != nil {
		return jobs.Job{}, err
	}
	return s.jobs.Get(ctx, req.jobID)
}

func validUploadName(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" &&
		name == filepath.Base(name) &&
		name != "." &&
		name != ".." &&
		!strings.ContainsAny(name, `/\`)
}

type uploadSizeQueue struct {
	sizes map[string][]int64
}

type uploadManifestItem struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

func newUploadSizeQueue() *uploadSizeQueue {
	return &uploadSizeQueue{sizes: make(map[string][]int64)}
}

func (q *uploadSizeQueue) Read(reader io.Reader) error {
	var items []uploadManifestItem
	if err := json.NewDecoder(reader).Decode(&items); err != nil {
		return err
	}
	for _, item := range items {
		if !validUploadName(filepath.Base(item.Name)) || item.Size < 0 {
			return files.ErrInvalidName
		}
		name := filepath.Base(item.Name)
		q.sizes[name] = append(q.sizes[name], item.Size)
	}
	return nil
}

func (q *uploadSizeQueue) Take(name string) int64 {
	name = filepath.Base(name)
	values := q.sizes[name]
	if len(values) == 0 {
		return 0
	}
	value := values[0]
	q.sizes[name] = values[1:]
	return value
}

func uploadConflictPolicy(r *http.Request) string {
	switch r.URL.Query().Get("conflictPolicy") {
	case "ask", "overwrite", "rename":
		return r.URL.Query().Get("conflictPolicy")
	default:
		return "rename"
	}
}

func resolveUploadConflict(destination, policy string) (string, error) {
	if _, err := os.Stat(destination); errors.Is(err, os.ErrNotExist) {
		return destination, nil
	} else if err != nil {
		return "", err
	}

	switch policy {
	case "overwrite":
		return destination, os.RemoveAll(destination)
	case "rename":
		return security.NextAvailablePath(destination)
	default:
		return "", files.ErrDestinationExists
	}
}

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
	if err != nil || totalSize <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid totalSize"})
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

	// ─── Job exists: check cancel/pause ───
	if jobID != "" {
		cancelled, err := s.jobs.IsCancelled(ctx, jobID)
		if err != nil {
			writeError(w, err)
			return
		}
		if cancelled {
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
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

	// ─── Setup temp file ───
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		writeError(w, err)
		return
	}
	f, err := os.OpenFile(partialPath, os.O_CREATE|os.O_WRONLY, 0o644)
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

	// ─── First chunk: create job ───
	if jobID == "" {
		job, err := s.jobs.Create(ctx, jobs.CreateRequest{
			Type:            jobs.TypeUpload,
			SourcePath:      filename,
			DestinationPath: destinationPublic,
			ConflictPolicy:  uploadConflictPolicy(r),
			VerifyMode:      "size",
		})
		if err != nil {
			_ = os.Remove(partialPath)
			writeError(w, err)
			return
		}
		jobID = job.ID
		if err := os.WriteFile(jobIDPath, []byte(jobID), 0o644); err != nil {
			_ = os.Remove(partialPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		if err := s.jobs.StartJob(ctx, job.ID); err != nil {
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		if err := s.jobs.SetJobTotals(ctx, job.ID, totalSize, 1); err != nil {
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
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
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
			_ = s.jobs.FailJob(ctx, job.ID, err)
			writeError(w, err)
			return
		}
		itemID = item.ID
		if err := s.jobs.UpdateJobProgress(ctx, job.ID, received, 0, filename); err != nil {
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
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

	// ─── Last chunk: finalize ───
	if complete {
		if itemID == "" {
			items, err := s.jobs.ListItems(ctx, jobID)
			if err != nil {
				_ = os.Remove(partialPath)
				_ = os.Remove(jobIDPath)
				_ = s.jobs.FailJob(ctx, jobID, err)
				writeError(w, err)
				return
			}
			if len(items) > 0 {
				itemID = items[0].ID
			}
		}
		if fi, err := os.Stat(partialPath); err != nil || fi.Size() != totalSize {
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
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
			_ = os.Remove(partialPath)
			_ = os.Remove(jobIDPath)
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
