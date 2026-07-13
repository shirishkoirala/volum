package api

import (
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/desktop"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/shares"
)

type Server struct {
	router           *chi.Mux
	files            *files.Service
	jobs             *jobs.Store
	guard            *security.RootGuard
	auth             *auth.Service
	authStore        *auth.Store
	shares           *shares.Store
	desktop          *desktop.Store
	healthChecker    *desktop.HealthChecker
	startTime        time.Time
	dbPath           string
	loginLimiter     *rateLimiter
	bootstrapToken   string
	allowedHosts     map[string]struct{}
	secureCookieHost string
}

func (s *Server) ConfigurePublicURL(rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("VOLUM_PUBLIC_URL must be an absolute http or https URL")
	}
	publicHost := strings.ToLower(parsed.Hostname())
	s.allowedHosts[publicHost] = struct{}{}
	if parsed.Scheme == "https" {
		s.secureCookieHost = publicHost
	} else {
		s.secureCookieHost = ""
	}
	return nil
}

func (s *Server) ConfigureAllowedHosts(value string) {
	for _, host := range strings.Split(value, ",") {
		host = strings.TrimSpace(strings.ToLower(host))
		if host == "" {
			continue
		}
		if parsedHost, _, err := net.SplitHostPort(host); err == nil {
			host = parsedHost
		}
		host = strings.Trim(host, "[]")
		s.allowedHosts[host] = struct{}{}
	}
}

func New(filesService *files.Service, jobStore *jobs.Store, guard *security.RootGuard, authService *auth.Service, authSt *auth.Store, shareStore *shares.Store, desktopStore *desktop.Store, healthChecker *desktop.HealthChecker, dbPath, bootstrapToken string) *Server {
	s := &Server{
		router:         chi.NewRouter(),
		files:          filesService,
		jobs:           jobStore,
		guard:          guard,
		auth:           authService,
		authStore:      authSt,
		shares:         shareStore,
		desktop:        desktopStore,
		healthChecker:  healthChecker,
		startTime:      time.Now(),
		dbPath:         dbPath,
		loginLimiter:   newRateLimiter(20, time.Minute),
		bootstrapToken: bootstrapToken,
		allowedHosts:   make(map[string]struct{}),
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) routes() {
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
	s.router.Use(s.securityHeaders)

	s.router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	s.router.Route("/api", func(r chi.Router) {
		r.Get("/session", s.handleSession)
		r.Post("/login", s.handleLogin)
		r.Post("/logout", s.handleLogout)
		r.Post("/setup", s.handleSetup)
		r.Get("/version", s.handleVersion)

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Use(s.requireAPIRequest)
			r.Get("/profile/avatar", s.handleGetAvatar)
			r.Put("/profile/avatar", s.handleUpdateAvatar)
			r.Delete("/profile/avatar", s.handleDeleteAvatar)
			r.Get("/roots", s.handleRoots)
			r.Get("/devices", s.handleDevices)
			r.Get("/files", s.handleFiles)
			r.Get("/files/download", s.handleDownload)
			r.Get("/files/raw", s.handleRaw)
			r.Get("/files/search", s.handleSearch)
			r.Get("/trash", s.handleTrash)
			r.Get("/jobs", s.handleJobs)
			r.Get("/jobs/events", s.handleJobEvents)
			r.Get("/jobs/{id}", s.handleJob)
			r.Get("/jobs/{id}/disk-usage", s.handleDiskUsageResults)
			r.Get("/jobs/{id}/disk-usage/summary", s.handleDiskUsageSummary)
			r.Get("/jobs/{id}/duplicates", s.handleDuplicateResults)
			r.Get("/jobs/{id}/duplicates/summary", s.handleDuplicateSummary)
			r.Get("/status", s.handleStatus)
			r.Get("/favorites", s.handleListFavorites)
			r.Post("/favorites", s.handleAddFavorite)
			r.Delete("/favorites", s.handleRemoveFavorite)
			r.Put("/favorites/reorder", s.handleReorderFavorites)
			r.Get("/services", s.handleListServices)
			r.Get("/services/health", s.handleServiceHealth)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Use(s.requireAPIRequest)
			r.Use(s.requireAdmin)
			r.Post("/services", s.handleCreateService)
			r.Put("/services/{id}", s.handleUpdateService)
			r.Delete("/services/{id}", s.handleDeleteService)
			r.Put("/services/reorder", s.handleReorderServices)
			r.Post("/files/file", s.handleCreateFile)
			r.Post("/files/folder", s.handleCreateFolder)
			r.Patch("/files/rename", s.handleRename)
			r.Post("/files/batch-rename", s.handleBatchRename)
			r.Delete("/files", s.handleDelete)
			r.Post("/trash/{id}/restore", s.handleRestoreTrash)
			r.Delete("/trash/{id}", s.handleDeleteTrash)
			r.Post("/files/upload", s.handleUpload)
			r.Get("/files/upload-status", s.handleUploadStatus)
			r.Post("/files/upload-chunk", s.handleUploadChunk)
			r.Patch("/files/permissions", s.handleChmod)
			r.Post("/jobs", s.handleCreateJob)
			r.Post("/jobs/{id}/cancel", s.handleCancelJob)
			r.Post("/jobs/{id}/retry", s.handleRetryJob)
			r.Post("/jobs/{id}/items/{itemId}/retry", s.handleRetryItem)
			r.Post("/jobs/{id}/pause", s.handlePauseJob)
			r.Post("/jobs/{id}/resume", s.handleResumeJob)
			r.Get("/jobs/{id}/conflicts", s.handleJobConflicts)
			r.Post("/jobs/{id}/resolve", s.handleResolveConflicts)
			r.Delete("/jobs/clear-completed", s.handleClearCompleted)
			r.Delete("/jobs/clear-failed", s.handleClearFailed)
			r.Post("/shares", s.handleCreateShare)
			r.Get("/shares", s.handleListShares)
			r.Delete("/shares/{id}", s.handleDeleteShare)
			r.Post("/db/vacuum", s.handleVacuum)
			r.Post("/db/prune-jobs", s.handlePruneJobs)
			r.Post("/db/prune-audit-logs", s.handlePruneAuditLogs)
			r.Get("/users", s.handleListUsers)
			r.Post("/users", s.handleCreateUser)
			r.Delete("/users/{id}", s.handleDeleteUser)
			r.Patch("/users/{id}/password", s.handleChangePassword)
			r.Patch("/users/{id}/role", s.handleChangeRole)
			r.Post("/users/{id}/revoke-sessions", s.handleRevokeUserSessions)
		})
	})

	s.router.Get("/api/public/{token}", s.handlePublicDownload)
	s.router.Post("/api/public/{token}/unlock", s.handlePublicUnlock)

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
