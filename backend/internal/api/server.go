package api

import (
	"archive/zip"
	"context"
	"database/sql"
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
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/worker"
)

type Server struct {
	router *chi.Mux
	files  *files.Service
	jobs   *jobs.Store
	guard  *security.RootGuard
	auth   *auth.Service
}

func New(filesService *files.Service, jobStore *jobs.Store, guard *security.RootGuard, authService *auth.Service) *Server {
	s := &Server{
		router: chi.NewRouter(),
		files:  filesService,
		jobs:   jobStore,
		guard:  guard,
		auth:   authService,
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) routes() {
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.RealIP)
	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)

	s.router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	s.router.Route("/api", func(r chi.Router) {
		r.Get("/session", s.handleSession)
		r.Post("/login", s.handleLogin)
		r.Post("/logout", s.handleLogout)

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Get("/roots", s.handleRoots)
			r.Get("/files", s.handleFiles)
			r.Get("/files/download", s.handleDownload)
			r.Get("/files/raw", s.handleRaw)
			r.Get("/files/search", s.handleSearch)
			r.Get("/trash", s.handleTrash)
			r.Get("/jobs", s.handleJobs)
			r.Get("/jobs/events", s.handleJobEvents)
			r.Get("/jobs/{id}", s.handleJob)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Use(s.requireAdmin)
			r.Post("/files/folder", s.handleCreateFolder)
			r.Patch("/files/rename", s.handleRename)
			r.Post("/files/batch-rename", s.handleBatchRename)
			r.Delete("/files", s.handleDelete)
			r.Post("/trash/{id}/restore", s.handleRestoreTrash)
			r.Delete("/trash/{id}", s.handleDeleteTrash)
			r.Post("/files/upload", s.handleUpload)
			r.Post("/jobs/copy", s.handleCreateCopyJob)
			r.Post("/jobs/move", s.handleCreateMoveJob)
			r.Post("/jobs/archive", s.handleCreateArchiveJob)
			r.Post("/jobs/extract", s.handleCreateExtractJob)
			r.Post("/jobs/checksum", s.handleCreateChecksumJob)
			r.Post("/jobs/{id}/cancel", s.handleCancelJob)
			r.Post("/jobs/{id}/retry", s.handleRetryJob)
			r.Post("/jobs/{id}/items/{itemId}/retry", s.handleRetryItem)
			r.Post("/jobs/{id}/pause", s.handlePauseJob)
			r.Post("/jobs/{id}/resume", s.handleResumeJob)
			r.Delete("/jobs/clear-completed", s.handleClearCompleted)
			r.Delete("/jobs/clear-failed", s.handleClearFailed)
		})
	})

	if _, err := os.Stat("web/index.html"); err == nil {
		fileServer := http.FileServer(http.Dir("web"))
		s.router.NotFound(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
				return
			}
			path := filepath.Join("web", filepath.Clean(r.URL.Path))
			if _, err := os.Stat(path); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
			http.ServeFile(w, r, "web/index.html")
		})
	}
}

func (s *Server) handleRoots(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"roots": s.files.RootUsage()})
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	user, ok := s.auth.UserFromRequest(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": ok,
		"role":          user.Role,
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role     auth.Role `json:"role"`
		Password string    `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	token, user, ok := s.auth.Login(req.Role, req.Password)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if s.auth.Enabled() {
		http.SetCookie(w, &http.Cookie{
			Name:     "volum_session",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   60 * 60 * 24 * 7,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": true,
		"role":          user.Role,
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "volum_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"authEnabled":   s.auth.Enabled(),
		"authenticated": !s.auth.Enabled(),
		"role":          "",
	})
}

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	showHidden := r.URL.Query().Get("hidden") == "true"
	entries, err := s.files.List(path, showHidden)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	entry, err := s.files.CreateFolder(req.Path, req.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

func (s *Server) handleRename(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	entry, err := s.files.Rename(req.Path, req.NewName)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

type batchRenameItem struct {
	Path    string `json:"path"`
	NewName string `json:"newName"`
}

func (s *Server) handleBatchRename(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []batchRenameItem `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if len(req.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no items provided"})
		return
	}

	errs := make([]map[string]string, 0)
	for _, item := range req.Items {
		if _, err := s.files.Rename(item.Path, item.NewName); err != nil {
			errs = append(errs, map[string]string{"path": item.Path, "error": err.Error()})
		}
	}

	if len(errs) > 0 {
		writeJSON(w, http.StatusOK, map[string]any{"errors": errs, "complete": len(req.Items) - len(errs)})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path        string `json:"path"`
		ConfirmName string `json:"confirmName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.ConfirmName == "" || filepath.Base(req.Path) != req.ConfirmName {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "delete confirmation did not match selected item"})
		return
	}

	entry, err := s.files.Trash(req.Path)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.jobs.CreateAuditLog(r.Context(), "trash", req.Path, "moved to trash "+entry.ID); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

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
	entry, err := s.files.RestoreTrash(id)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.jobs.CreateAuditLog(r.Context(), "restore", entry.Path, "restored from trash"); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entry)
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

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	path, info, err := s.files.DownloadPath(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, err)
		return
	}

	if !info.IsDir() {
		w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(info.Name()))
		http.ServeFile(w, r, path)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(info.Name()+".zip"))
	zw := zip.NewWriter(w)
	defer zw.Close()

	err = filepath.WalkDir(path, func(filePath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(path, filePath)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		header.Method = zip.Deflate
		if entry.IsDir() {
			header.Name += "/"
			_, err := zw.CreateHeader(header)
			return err
		}
		w, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}
		f, err := os.Open(filePath)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(w, f)
		return err
	})
	if err != nil {
		writeError(w, err)
	}
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	limitParam := r.URL.Query().Get("limit")
	limit := 50
	if v, err := strconv.Atoi(limitParam); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	results, err := s.files.Search(query, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (s *Server) handleRaw(w http.ResponseWriter, r *http.Request) {
	path, info, err := s.files.DownloadPath(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "inline; filename="+strconv.Quote(info.Name()))
	http.ServeFile(w, r, path)
}

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	targetDir, err := s.guard.Resolve(r.URL.Query().Get("path"))
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
		job, err := s.uploadPart(r.Context(), targetDir, part, uploadConflictPolicy(r), expectedBytes)
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

func (s *Server) uploadPart(ctx context.Context, targetDir string, part *multipart.Part, conflictPolicy string, expectedBytes int64) (jobs.Job, error) {
	name := filepath.Base(part.FileName())
	if !validUploadName(name) {
		return jobs.Job{}, files.ErrInvalidName
	}

	destination, err := s.guard.Resolve(filepath.Join(targetDir, name))
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
	name = filepath.Base(destination)

	job, err := s.jobs.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeUpload,
		SourcePath:      name,
		DestinationPath: destination,
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
	if finalDestination, err := resolveUploadConflict(destination, conflictPolicy); err != nil {
		_ = os.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	} else if finalDestination != destination {
		destination = finalDestination
	}
	if err := os.Rename(tempPath, destination); err != nil {
		_ = os.Remove(tempPath)
		_ = s.jobs.FailJob(ctx, job.ID, err)
		return jobs.Job{}, err
	}
	_ = os.Remove(filepath.Dir(tempPath))

	if err := s.jobs.SetJobTotals(ctx, job.ID, written, 1); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.UpdateItemStatus(ctx, item.ID, jobs.StatusCompleted, written, nil); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.UpdateJobProgress(ctx, job.ID, written, 1, name); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.CompleteJob(ctx, job.ID); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.CreateAuditLog(ctx, "upload", destination, "uploaded "+name); err != nil {
		return jobs.Job{}, err
	}
	return s.jobs.Get(ctx, job.ID)
}

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

func (s *Server) handleCreateExtractJob(w http.ResponseWriter, r *http.Request) {
	var req jobs.CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	req.Type = jobs.TypeExtract
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
	format := worker.ArchiveFormat(req.SourcePath)
	if format == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported archive format, supported: .zip, .tar, .tar.gz, .tgz"})
		return
	}
	req.SourcePath = source

	destination, err := s.guard.Resolve(req.DestinationPath)
	if err != nil {
		writeError(w, err)
		return
	}
	req.DestinationPath = destination

	job, err := s.jobs.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, job)
}

func (s *Server) handleCreateChecksumJob(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourcePath string `json:"sourcePath"`
		VerifyMode string `json:"verifyMode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.SourcePath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourcePath is required"})
		return
	}
	if req.VerifyMode == "" {
		req.VerifyMode = "sha256"
	}
	if req.VerifyMode != "md5" && req.VerifyMode != "sha256" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "verifyMode must be md5 or sha256"})
		return
	}

	source, err := s.guard.Resolve(req.SourcePath)
	if err != nil {
		writeError(w, err)
		return
	}

	job, err := s.jobs.Create(r.Context(), jobs.CreateRequest{
		Type:       jobs.TypeChecksum,
		SourcePath: source,
		VerifyMode: req.VerifyMode,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, job)
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
	destination, err := s.guard.Resolve(req.DestinationPath)
	if err != nil {
		writeError(w, err)
		return
	}
	req.SourcePath = source
	req.DestinationPath = destination
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
		if err := s.jobs.CreateAuditLog(r.Context(), "move_queued", source, "queued move to "+destination); err != nil {
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

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, security.ErrEmptyPath),
		errors.Is(err, security.ErrPathTraversal),
		errors.Is(err, security.ErrOutsideRoots),
		errors.Is(err, files.ErrInvalidName),
		errors.Is(err, files.ErrRootOperation),
		errors.Is(err, files.ErrDirectoryDownload),
		errors.Is(err, files.ErrTrashOperation),
		errors.Is(err, jobs.ErrInvalidConflictPolicy):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, files.ErrDestinationExists):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	case errors.Is(err, os.ErrPermission):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "permission denied"})
	case errors.Is(err, os.ErrNotExist):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
}

func (s *Server) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := s.auth.UserFromRequest(r)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
			return
		}
		next.ServeHTTP(w, r.WithContext(s.auth.WithUser(r.Context(), user)))
	})
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user.Role != auth.RoleAdmin {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin role required"})
			return
		}
		next.ServeHTTP(w, r)
	})
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
		return nextAvailableUploadPath(destination)
	default:
		return "", files.ErrDestinationExists
	}
}

func nextAvailableUploadPath(path string) (string, error) {
	ext := filepath.Ext(path)
	base := path[:len(path)-len(ext)]
	for i := 1; i <= 1000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("could not find available name for %s", path)
}
