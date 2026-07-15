package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/desktop"
	"github.com/volum-app/volum/backend/internal/shares"
)

func TestServiceHealthBlocksLoopback(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	localServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer localServer.Close()

	createLocal := ts.post("/api/services", map[string]string{
		"name":      "Local",
		"url":       localServer.URL,
		"healthUrl": localServer.URL + "/health",
	})
	if createLocal.StatusCode != http.StatusCreated {
		t.Fatalf("expected local service create 201, got %d", createLocal.StatusCode)
	}
	var localService desktop.ServiceRecord
	readJSON(t, createLocal, &localService)

	createUnchecked := ts.post("/api/services", map[string]string{
		"name": "Unchecked",
		"url":  "https://unchecked.example.com",
	})
	if createUnchecked.StatusCode != http.StatusCreated {
		t.Fatalf("expected unchecked service create 201, got %d", createUnchecked.StatusCode)
	}
	var uncheckedSvc desktop.ServiceRecord
	readJSON(t, createUnchecked, &uncheckedSvc)

	resp := ts.get("/api/services/health")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
	var body map[string]desktop.ServiceHealthResult
	readJSON(t, resp, &body)

	result := body[localService.ID]
	if result.Status != "unhealthy" || !strings.Contains(result.Error, "blocked destination") {
		t.Fatalf("expected loopback health URL to be blocked, got %#v", result)
	}
	if _, ok := body[uncheckedSvc.ID]; ok {
		t.Fatal("did not expect service without health URL in health response")
	}
}

func TestReadonlyUserCannotMutateServices(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	record, err := ts.authStore.CreateUser(context.Background(), "reader", "reader-password", auth.RoleReadonly)
	if err != nil {
		t.Fatal(err)
	}
	token, _, ok := ts.auth.Login(context.Background(), record.Username, "reader-password", false)
	if !ok {
		t.Fatal("expected readonly login to succeed")
	}

	body := bytes.NewBufferString(`{"name":"Service","url":"https://example.com"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/services", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: token})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected readonly service mutation to return 403, got %d", w.Code)
	}
}

func TestPasswordProtectedShareUsesUnlockCookie(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	path := filepath.Join(ts.root, "shared.txt")
	if err := os.WriteFile(path, []byte("shared content"), 0o644); err != nil {
		t.Fatal(err)
	}
	share, err := ts.shares.Create(shares.CreateRequest{Path: path, Password: "share-password"}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	request := func(method, target, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.RemoteAddr = "192.0.2.40:1234"
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		if cookie != nil {
			req.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		ts.Handler().ServeHTTP(w, req)
		return w
	}

	publicPath := "/api/public/" + share.Token
	if w := request(http.MethodGet, publicPath+"?password=share-password", "", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("expected query-string password to be rejected, got %d", w.Code)
	}
	if w := request(http.MethodPost, publicPath+"/unlock", `{"password":"wrong"}`, nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("expected wrong password to return 401, got %d", w.Code)
	}

	unlock := request(http.MethodPost, publicPath+"/unlock", `{"password":"share-password"}`, nil)
	if unlock.Code != http.StatusNoContent {
		t.Fatalf("expected unlock to return 204, got %d: %s", unlock.Code, unlock.Body.String())
	}
	result := unlock.Result()
	var accessCookie *http.Cookie
	for _, cookie := range result.Cookies() {
		if cookie.Name == shareAccessCookieName(share.Token) {
			accessCookie = cookie
		}
	}
	result.Body.Close()
	if accessCookie == nil || !accessCookie.HttpOnly || accessCookie.SameSite != http.SameSiteStrictMode {
		t.Fatalf("expected hardened share access cookie, got %#v", accessCookie)
	}

	download := request(http.MethodGet, publicPath, "", accessCookie)
	if download.Code != http.StatusOK || download.Body.String() != "shared content" {
		t.Fatalf("expected unlocked download, got %d: %s", download.Code, download.Body.String())
	}
}
