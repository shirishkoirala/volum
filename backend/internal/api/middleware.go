package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("writeJSON encode failed", "status", status, "error", err)
	}
}

func disableWriteDeadline(w http.ResponseWriter) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
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

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := requestHostname(r)
		if len(s.allowedHosts) > 0 {
			if _, allowed := s.allowedHosts[host]; !allowed {
				writeJSON(w, http.StatusMisdirectedRequest, map[string]string{"error": "request host is not allowed"})
				return
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src 'self' http: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			sensitiveResponse(w)
		}
		next.ServeHTTP(w, r)
	})
}

func sensitiveResponse(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
}

func (s *Server) secureCookie(r *http.Request) bool {
	return r.TLS != nil || (s.secureCookieHost != "" && requestHostname(r) == s.secureCookieHost)
}

func requestHostname(r *http.Request) string {
	host := strings.ToLower(r.Host)
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	return strings.Trim(host, "[]")
}

func IsMaxBytesError(err error) bool {
	if err == nil {
		return false
	}
	var maxBytesErr *http.MaxBytesError
	return errors.As(err, &maxBytesErr)
}
