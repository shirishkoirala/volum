package api

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/desktop"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/shares"
	"github.com/volum-app/volum/backend/internal/storage"
)

func TestHealthz(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.get("/healthz")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body map[string]string
	readJSON(t, resp, &body)
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %v", body)
	}
}

func TestSecurityHeadersAndSensitiveCaching(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.get("/api/session")
	if resp.Header.Get("Content-Security-Policy") == "" {
		t.Fatal("expected Content-Security-Policy header")
	}
	if resp.Header.Get("Permissions-Policy") == "" {
		t.Fatal("expected Permissions-Policy header")
	}
	if resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("expected sensitive response to disable caching, got %q", resp.Header.Get("Cache-Control"))
	}
	resp.Body.Close()
}

func TestUnsafeAPIRequiresCSRFHeader(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	body := bytes.NewBufferString(`{"name":"Service","url":"https://example.com"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/services", body)
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected missing CSRF header to return 403, got %d", w.Code)
	}
}

func TestUnsafeAPIRejectsMismatchedOrigin(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	body := bytes.NewBufferString(`{"name":"Service","url":"https://example.com"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/services", body)
	req.Host = "volum.example.com"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Volum-Request", "fetch")
	req.Header.Set("Origin", "https://attacker.example.com")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected mismatched Origin to return 403, got %d", w.Code)
	}
}

func TestConfiguredPublicHostIsEnforced(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	if err := ts.ConfigurePublicURL("https://volum.example.com"); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Host = "attacker.example.com"
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusMisdirectedRequest {
		t.Fatalf("expected invalid host to return 421, got %d", w.Code)
	}
}

func TestAdminJSONBodyLimit(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	body := bytes.NewBufferString(`{"path":"` + strings.Repeat("a", maxBodyBytes+1) + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/files/folder", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected oversized JSON to return 413, got %d", w.Code)
	}
}

func TestBatchRenameItemLimit(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	items := make([]map[string]string, maxJSONItems+1)
	for i := range items {
		items[i] = map[string]string{"path": filepath.Join(ts.root, "a.txt"), "newName": "b.txt"}
	}
	resp := ts.post("/api/files/batch-rename", map[string]any{"items": items})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected too many items to return 400, got %d", resp.StatusCode)
	}
}

func TestSessionWithoutAuth(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.get("/api/session")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body struct {
		AuthEnabled   bool   `json:"authEnabled"`
		Authenticated bool   `json:"authenticated"`
		SetupRequired bool   `json:"setupRequired"`
		UserId        string `json:"userId"`
		Username      string `json:"username"`
		Role          string `json:"role"`
	}
	readJSON(t, resp, &body)
	if body.AuthEnabled != true || !body.Authenticated || body.Role != "admin" {
		t.Fatalf("unexpected session: %#v", body)
	}
	if body.UserId == "" || body.Username != "admin" {
		t.Fatalf("expected user info in session: %#v", body)
	}
}

func TestInitialSetupRequiresToken(t *testing.T) {
	root := t.TempDir()
	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(filepath.Join(root, "setup.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	authStore := auth.NewStore(db)
	authService, err := auth.New(authStore, "setup-test-session-secret")
	if err != nil {
		t.Fatal(err)
	}
	jobStore := jobs.NewStore(db)
	desktopStore := desktop.NewStore(db)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := New(
		files.NewService(guard, files.NewDirSizeCache(0)),
		jobStore,
		guard,
		authService,
		authStore,
		shares.NewStore(db),
		desktopStore,
		desktop.NewHealthChecker(desktopStore, logger),
		filepath.Join(root, "setup.db"),
		"expected-bootstrap-token",
	)

	requestSetup := func(token string) *httptest.ResponseRecorder {
		body := bytes.NewBufferString(`{"username":"admin","password":"admin-password"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/setup", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Bootstrap-Token", token)
		w := httptest.NewRecorder()
		server.Handler().ServeHTTP(w, req)
		return w
	}

	if w := requestSetup(""); w.Code != http.StatusForbidden {
		t.Fatalf("expected missing token to return 403, got %d", w.Code)
	}
	if w := requestSetup("wrong"); w.Code != http.StatusForbidden {
		t.Fatalf("expected wrong token to return 403, got %d", w.Code)
	}
	if w := requestSetup("expected-bootstrap-token"); w.Code != http.StatusCreated {
		t.Fatalf("expected setup to succeed, got %d: %s", w.Code, w.Body.String())
	}
	if w := requestSetup("expected-bootstrap-token"); w.Code != http.StatusForbidden {
		t.Fatalf("expected repeated setup to return 403, got %d", w.Code)
	}
}

func TestLoginRememberMeControlsCookiePersistence(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	for _, test := range []struct {
		name       string
		rememberMe bool
		persistent bool
	}{
		{name: "session cookie", rememberMe: false, persistent: false},
		{name: "persistent cookie", rememberMe: true, persistent: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			body := bytes.NewBufferString(`{"username":"admin","password":"adminpass","rememberMe":` + fmt.Sprint(test.rememberMe) + `}`)
			req := httptest.NewRequest(http.MethodPost, "/api/login", body)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			ts.Server.Handler().ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", w.Code)
			}
			cookies := w.Result().Cookies()
			if len(cookies) != 1 {
				t.Fatalf("expected one session cookie, got %d", len(cookies))
			}
			persistent := cookies[0].MaxAge > 0 && !cookies[0].Expires.IsZero()
			if persistent != test.persistent {
				t.Fatalf("expected persistent=%t, cookie=%#v", test.persistent, cookies[0])
			}
		})
	}
}

func TestHTTPSPublicURLSetsSecureSessionCookie(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	if err := ts.ConfigurePublicURL("https://volum.example.com"); err != nil {
		t.Fatal(err)
	}
	body := bytes.NewBufferString(`{"username":"admin","password":"adminpass"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/login", body)
	req.Host = "volum.example.com"
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", w.Code, w.Body.String())
	}
	found := false
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == "volum_session" {
			found = true
			if !cookie.Secure || !cookie.HttpOnly {
				t.Fatalf("expected secure HttpOnly session cookie, got %#v", cookie)
			}
		}
	}
	if !found {
		t.Fatal("expected session cookie")
	}
}

func TestHTTPSPublicURLDoesNotBreakLocalHTTPLogin(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	if err := ts.ConfigurePublicURL("https://volum.example.com"); err != nil {
		t.Fatal(err)
	}
	ts.ConfigureAllowedHosts("localhost")

	body := bytes.NewBufferString(`{"username":"admin","password":"adminpass"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/login", body)
	req.Host = "localhost:8342"
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", w.Code, w.Body.String())
	}

	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == "volum_session" && cookie.Secure {
			t.Fatalf("local HTTP session cookie must not be Secure, got %#v", cookie)
		}
	}
}

func TestLoginCookieAuthenticatesReloadAndProtectedRequest(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	body := bytes.NewBufferString(`{"username":"admin","password":"adminpass"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", body)
	loginReq.Header.Set("Content-Type", "application/json")
	loginRecorder := httptest.NewRecorder()
	ts.Handler().ServeHTTP(loginRecorder, loginReq)
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", loginRecorder.Code, loginRecorder.Body.String())
	}

	var sessionCookie *http.Cookie
	for _, cookie := range loginRecorder.Result().Cookies() {
		if cookie.Name == "volum_session" {
			sessionCookie = cookie
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected login to return a session cookie")
	}

	for _, path := range []string{"/api/session", "/api/roots"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(sessionCookie)
		w := httptest.NewRecorder()
		ts.Handler().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected authenticated request to %s to return 200, got %d: %s", path, w.Code, w.Body.String())
		}
		if path == "/api/session" && !strings.Contains(w.Body.String(), `"authenticated":true`) {
			t.Fatalf("expected refreshed session to remain authenticated, got %s", w.Body.String())
		}
	}
}

func TestLogoutRevokesExistingSession(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	oldCookie := ts.cookie

	resp := ts.post("/api/logout", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected logout 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/roots", nil)
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: oldCookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected old session to be revoked, got %d", w.Code)
	}
}

func TestLoginRateLimitIgnoresForwardedFor(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	ts.loginLimiter = newRateLimiter(20, time.Minute)

	for attempt := 1; attempt <= 21; attempt++ {
		body := bytes.NewBufferString(`{"username":"admin","password":"wrong-password"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/login", body)
		req.RemoteAddr = "192.0.2.20:1234"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("198.51.100.%d", attempt))
		w := httptest.NewRecorder()
		ts.Server.Handler().ServeHTTP(w, req)
		if attempt <= 20 && w.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401, got %d", attempt, w.Code)
		}
		if attempt == 21 && w.Code != http.StatusTooManyRequests {
			t.Fatalf("expected spoofed forwarding headers to remain rate limited, got %d", w.Code)
		}
	}
}

func TestLoginRateLimitLocksAccountAcrossIPs(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	ts.loginLimiter = newRateLimiter(2, time.Minute)

	requestLogin := func(remoteAddr, password string) int {
		body := bytes.NewBufferString(fmt.Sprintf(`{"username":"admin","password":%q}`, password))
		req := httptest.NewRequest(http.MethodPost, "/api/login", body)
		req.RemoteAddr = remoteAddr
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		ts.Server.Handler().ServeHTTP(w, req)
		return w.Code
	}

	if status := requestLogin("192.0.2.20:1234", "wrong-password"); status != http.StatusUnauthorized {
		t.Fatalf("expected first failed login to return 401, got %d", status)
	}
	if status := requestLogin("192.0.2.20:1234", "wrong-password"); status != http.StatusUnauthorized {
		t.Fatalf("expected second failed login to return 401, got %d", status)
	}
	if status := requestLogin("192.0.2.20:1234", "wrong-password"); status != http.StatusTooManyRequests {
		t.Fatalf("expected source IP to be rate limited, got %d", status)
	}
	if status := requestLogin("198.51.100.30:1234", "adminpass"); status != http.StatusTooManyRequests {
		t.Fatalf("expected account bucket to be rate limited across IPs, got %d", status)
	}
}
