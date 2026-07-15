package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

// routeGroup defines a set of routes with expected middleware behavior.
type routeGroup struct {
	name       string
	routes     []routeSpec
	middleware middlewareLevel
}

type routeSpec struct {
	method string
	path   string
	body   string
}

type middlewareLevel int

const (
	publicRoute middlewareLevel = iota // no auth required
	authRoute                          // requireUser + requireAPIRequest
	adminRoute                         // requireUser + requireAPIRequest + requireAdmin
)

func TestRouteMiddlewareGroups(t *testing.T) {
	groups := []routeGroup{
		{
			name: "public",
			routes: []routeSpec{
				{method: http.MethodGet, path: "/healthz"},
				{method: http.MethodGet, path: "/api/session"},
				{method: http.MethodPost, path: "/api/login", body: `{"username":"admin","password":"adminpass"}`},
				{method: http.MethodPost, path: "/api/logout"},
				{method: http.MethodGet, path: "/api/version"},
				{method: http.MethodGet, path: "/api/public/testtoken"},
				{method: http.MethodPost, path: "/api/public/testtoken/unlock"},
			},
			middleware: publicRoute,
		},
		{
			name: "authenticated-readonly",
			routes: []routeSpec{
				{method: http.MethodGet, path: "/api/roots"},
				{method: http.MethodGet, path: "/api/devices"},
				{method: http.MethodGet, path: "/api/files?path=/" + t.TempDir()},
				{method: http.MethodGet, path: "/api/files/download?path=/" + t.TempDir()},
				{method: http.MethodGet, path: "/api/files/raw?path=/" + t.TempDir()},
				{method: http.MethodGet, path: "/api/files/search?query=test"},
				{method: http.MethodGet, path: "/api/trash"},
				{method: http.MethodGet, path: "/api/jobs"},
				{method: http.MethodGet, path: "/api/jobs/events"},
				{method: http.MethodGet, path: "/api/favorites"},
				{method: http.MethodGet, path: "/api/services"},
				{method: http.MethodGet, path: "/api/services/health"},
				{method: http.MethodGet, path: "/api/profile/avatar"},
				{method: http.MethodGet, path: "/api/status"},
			},
			middleware: authRoute,
		},
		{
			name: "admin-mutating",
			routes: []routeSpec{
				{method: http.MethodPost, path: "/api/services", body: `{"name":"Test","url":"https://example.com","icon":"globe"}`},
				{method: http.MethodPut, path: "/api/services/test-id", body: `{"name":"Updated"}`},
				{method: http.MethodDelete, path: "/api/services/test-id"},
				{method: http.MethodPut, path: "/api/services/reorder", body: `["a","b"]`},
				{method: http.MethodPost, path: "/api/files/file", body: `{"path":"/test","name":"file.txt"}`},
				{method: http.MethodPost, path: "/api/files/folder", body: `{"path":"/test","name":"dir"}`},
				{method: http.MethodPatch, path: "/api/files/rename", body: `{"path":"/old","newName":"new"}`},
				{method: http.MethodPost, path: "/api/files/batch-rename", body: `{"path":"/","items":[]}`},
				{method: http.MethodDelete, path: "/api/files", body: `{"path":"/test"}`},
				{method: http.MethodDelete, path: "/api/trash/test-id"},
				{method: http.MethodPost, path: "/api/trash/test-id/restore"},
				{method: http.MethodPost, path: "/api/files/upload?path=/" + t.TempDir()},
				{method: http.MethodGet, path: "/api/files/upload-status?path=/" + t.TempDir() + "&filename=test.txt"},
				{method: http.MethodPost, path: "/api/files/upload-chunk?path=/" + t.TempDir() + "&filename=test.txt&offset=0&totalSize=10", body: "chunkdata"},
				{method: http.MethodPatch, path: "/api/files/permissions", body: `{"path":"/test","mode":"0755"}`},
				{method: http.MethodPost, path: "/api/jobs", body: `{"type":"copy","sourcePath":"/src","destinationPath":"/dst"}`},
				{method: http.MethodPost, path: "/api/jobs/test-id/cancel"},
				{method: http.MethodPost, path: "/api/jobs/test-id/retry"},
				{method: http.MethodPost, path: "/api/jobs/test-id/pause"},
				{method: http.MethodPost, path: "/api/jobs/test-id/resume"},
				{method: http.MethodGet, path: "/api/jobs/test-id/conflicts"},
				{method: http.MethodPost, path: "/api/jobs/test-id/resolve", body: `{"defaultResolution":"skip"}`},
				{method: http.MethodDelete, path: "/api/jobs/clear-completed"},
				{method: http.MethodDelete, path: "/api/jobs/clear-failed"},
				{method: http.MethodPost, path: "/api/shares", body: `{"path":"/","password":""}`},
				{method: http.MethodGet, path: "/api/shares"},
				{method: http.MethodDelete, path: "/api/shares/test-id"},
				{method: http.MethodPost, path: "/api/db/vacuum"},
				{method: http.MethodPost, path: "/api/db/prune-jobs"},
				{method: http.MethodPost, path: "/api/db/prune-audit-logs"},
				{method: http.MethodGet, path: "/api/users"},
				{method: http.MethodPost, path: "/api/users", body: `{"username":"newuser","password":"pass","role":"readonly"}`},
				{method: http.MethodDelete, path: "/api/users/test-id"},
				{method: http.MethodPatch, path: "/api/users/test-id/password", body: `{"password":"newpass"}`},
				{method: http.MethodPatch, path: "/api/users/test-id/role", body: `{"role":"admin"}`},
				{method: http.MethodPost, path: "/api/users/test-id/revoke-sessions"},
			},
			middleware: adminRoute,
		},
	}

	for _, group := range groups {
		t.Run(group.name+"_noAuth", func(t *testing.T) {
			ts, cleanup := setupTestServer(t)
			defer cleanup()
			for _, rt := range group.routes {
				t.Run(rt.method+" "+rt.path, func(t *testing.T) {
					req := httptest.NewRequest(rt.method, rt.path, bytes.NewBufferString(rt.body))
					if rt.body != "" {
						req.Header.Set("Content-Type", "application/json")
					}
					w := httptest.NewRecorder()
					ts.Handler().ServeHTTP(w, req)

					switch group.middleware {
					case publicRoute:
						// Public routes should work without auth (may 404 for implementation reasons)
						if w.Code == http.StatusUnauthorized || w.Code == http.StatusForbidden {
							t.Errorf("public route %s %s returned %d (should not require auth)", rt.method, rt.path, w.Code)
						}
					case authRoute:
						if w.Code != http.StatusUnauthorized {
							t.Errorf("auth route %s %s returned %d without cookie (expected 401)", rt.method, rt.path, w.Code)
						}
					case adminRoute:
						if w.Code != http.StatusUnauthorized {
							t.Errorf("admin route %s %s returned %d without cookie (expected 401)", rt.method, rt.path, w.Code)
						}
					}
				})
			}
		})
	}

	for _, group := range groups {
		if group.middleware == publicRoute {
			continue
		}
		t.Run(group.name+"_noCSRF", func(t *testing.T) {
			ts, cleanup := setupTestServer(t)
			defer cleanup()
			for _, rt := range group.routes {
				if rt.method == http.MethodGet || rt.method == http.MethodHead || rt.method == http.MethodOptions || rt.method == http.MethodTrace {
					continue // safe methods don't need CSRF
				}
				t.Run(rt.method+" "+rt.path, func(t *testing.T) {
					req := httptest.NewRequest(rt.method, rt.path, bytes.NewBufferString(rt.body))
					if rt.body != "" {
						req.Header.Set("Content-Type", "application/json")
					}
					req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
					w := httptest.NewRecorder()
					ts.Handler().ServeHTTP(w, req)

					if w.Code != http.StatusForbidden {
						t.Errorf("auth/admin route %s %s returned %d without CSRF header (expected 403)", rt.method, rt.path, w.Code)
					}
				})
			}
		})
	}

	t.Run("admin_routes_nonAdmin", func(t *testing.T) {
		ts, cleanup := setupTestServer(t)
		defer cleanup()

		roCookie := createReadonlyUserAndLogin(t, ts)
		readonlyGroup := groups[2] // admin routes

		for _, rt := range readonlyGroup.routes {
			t.Run(rt.method+" "+rt.path, func(t *testing.T) {
				req := httptest.NewRequest(rt.method, rt.path, bytes.NewBufferString(rt.body))
				if rt.body != "" {
					req.Header.Set("Content-Type", "application/json")
				}
				req.AddCookie(&http.Cookie{Name: "volum_session", Value: roCookie})
				req.Header.Set("X-Volum-Request", "fetch")
				w := httptest.NewRecorder()
				ts.Handler().ServeHTTP(w, req)

				if w.Code != http.StatusForbidden {
					t.Errorf("admin route %s %s returned %d for readonly user (expected 403)", rt.method, rt.path, w.Code)
				}
			})
		}
	})
}

func createReadonlyUserAndLogin(t *testing.T, ts *testServer) string {
	t.Helper()

	// Create readonly user
	roReq := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewBufferString(`{"username":"reader","password":"readonlyuserpass","role":"readonly"}`))
	roReq.Header.Set("Content-Type", "application/json")
	roReq.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	roReq.Header.Set("X-Volum-Request", "fetch")
	roW := httptest.NewRecorder()
	ts.Handler().ServeHTTP(roW, roReq)
	if roW.Code != http.StatusCreated && roW.Code != http.StatusOK {
		t.Fatalf("create readonly user failed: %d", roW.Code)
	}

	// Login as readonly user
	loginBody := bytes.NewBufferString(`{"username":"reader","password":"readonlyuserpass"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", loginBody)
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	ts.Handler().ServeHTTP(loginW, loginReq)
	if loginW.Code != http.StatusOK {
		t.Fatalf("readonly login failed: %d", loginW.Code)
	}

	var cookie string
	for _, c := range loginW.Result().Cookies() {
		if c.Name == "volum_session" {
			cookie = c.Value
			break
		}
	}
	if cookie == "" {
		t.Fatal("no session cookie in login response")
	}
	return cookie
}
