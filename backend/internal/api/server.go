package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

type Server struct {
	router *chi.Mux
	files  *files.Service
	jobs   *jobs.Store
	guard  *security.RootGuard
}

func New(filesService *files.Service, jobStore *jobs.Store, guard *security.RootGuard) *Server {
	s := &Server{
		router: chi.NewRouter(),
		files:  filesService,
		jobs:   jobStore,
		guard:  guard,
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
		r.Get("/roots", s.handleRoots)
		r.Get("/files", s.handleFiles)
		r.Post("/files/folder", s.handleCreateFolder)
		r.Patch("/files/rename", s.handleRename)
		r.Delete("/files", s.handleDelete)
		r.Get("/files/download", s.handleDownload)

		r.Get("/jobs", s.handleJobs)
		r.Post("/jobs/copy", s.handleCreateCopyJob)
		r.Get("/jobs/{id}", s.handleJob)
		r.Post("/jobs/{id}/cancel", s.handleCancelJob)
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
	writeJSON(w, http.StatusOK, map[string]any{"roots": s.files.Roots()})
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

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	if err := s.files.Delete(req.Path); err != nil {
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

	w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(info.Name()))
	http.ServeFile(w, r, path)
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	jobs, err := s.jobs.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs})
}

func (s *Server) handleCreateCopyJob(w http.ResponseWriter, r *http.Request) {
	var req jobs.CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	req.Type = jobs.TypeCopy
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

	job, err := s.jobs.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
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
		errors.Is(err, files.ErrDirectoryDownload):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, files.ErrDestinationExists):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	case errors.Is(err, os.ErrNotExist):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
}
