package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/shares"
)

type Server struct {
	router    *chi.Mux
	files     *files.Service
	jobs      *jobs.Store
	guard     *security.RootGuard
	auth      *auth.Service
	shares    *shares.Store
	startTime time.Time
	dbPath    string
}

func New(filesService *files.Service, jobStore *jobs.Store, guard *security.RootGuard, authService *auth.Service, shareStore *shares.Store, dbPath string) *Server {
	s := &Server{
		router:    chi.NewRouter(),
		files:     filesService,
		jobs:      jobStore,
		guard:     guard,
		auth:      authService,
		shares:    shareStore,
		startTime: time.Now(),
		dbPath:    dbPath,
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
		r.Get("/version", s.handleVersion)

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Get("/roots", s.handleRoots)
			r.Get("/devices", s.handleDevices)
			r.Get("/files", s.handleFiles)
			r.Get("/files/download", s.handleDownload)
			r.Get("/files/raw", s.handleRaw)
			r.Get("/files/search", s.handleSearch)
			r.Get("/files/sizes", s.handleDirSizes)
			r.Get("/files/analyze", s.handleAnalyzeDiskUsage)
			r.Get("/trash", s.handleTrash)
			r.Get("/jobs", s.handleJobs)
			r.Get("/jobs/events", s.handleJobEvents)
			r.Get("/jobs/{id}", s.handleJob)
			r.Get("/status", s.handleStatus)
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
			r.Patch("/files/permissions", s.handleChmod)
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
			r.Post("/shares", s.handleCreateShare)
			r.Get("/shares", s.handleListShares)
			r.Delete("/shares/{id}", s.handleDeleteShare)
			r.Post("/db/vacuum", s.handleVacuum)
			r.Post("/db/prune-jobs", s.handlePruneJobs)
			r.Post("/db/prune-audit-logs", s.handlePruneAuditLogs)
		})
	})

	s.router.Get("/api/public/{token}", s.handlePublicDownload)

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
