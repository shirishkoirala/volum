package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/desktop"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/shares"
	"github.com/volum-app/volum/backend/internal/storage"
)

type testServer struct {
	*Server
	root   string
	cookie string
}

func setupTestServer(t *testing.T) (*testServer, func()) {
	t.Helper()
	root := t.TempDir()

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}

	filesService := files.NewService(guard, files.NewDirSizeCache(0))

	db, err := storage.Open(filepath.Join(root, "volum.db"))
	if err != nil {
		t.Fatal(err)
	}

	authStore := auth.NewStore(db)
	authService, err := auth.New(authStore, "test-secret")
	if err != nil {
		t.Fatal(err)
	}

	jobStore := jobs.NewStore(db)
	shareStore := shares.NewStore(db)
	desktopStore := desktop.NewStore(db)
	slogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	healthChecker := desktop.NewHealthChecker(desktopStore, slogger)
	s := New(filesService, jobStore, guard, authService, authStore, shareStore, desktopStore, healthChecker, filepath.Join(root, "volum.db"), "")

	ctx := context.Background()
	_, err = authStore.CreateUser(ctx, "admin", "adminpass", auth.RoleAdmin)
	if err != nil {
		t.Fatal(err)
	}

	var loginResp struct {
		Authenticated bool `json:"authenticated"`
	}
	loginBody := bytes.NewBufferString(`{"username":"admin","password":"adminpass"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", loginBody)
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	s.Handler().ServeHTTP(loginW, loginReq)
	if err := json.NewDecoder(loginW.Result().Body).Decode(&loginResp); err != nil {
		t.Fatal(err)
	}
	if !loginResp.Authenticated {
		t.Fatal("failed to authenticate test user")
	}
	cookie := ""
	for _, c := range loginW.Result().Cookies() {
		if c.Name == "volum_session" {
			cookie = c.Value
			break
		}
	}
	if cookie == "" {
		t.Fatal("no session cookie after login")
	}

	ts := &testServer{Server: s, root: root, cookie: cookie}

	return ts, func() {
		db.Close()
	}
}

func (ts *testServer) request(method, path string, body any) *http.Response {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if !safeMethod(method) {
		req.Header.Set("X-Volum-Request", "fetch")
	}
	if ts.cookie != "" {
		req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	}
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
}

func (ts *testServer) upload(path string, files map[string]string) *http.Response {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	manifest := make([]map[string]any, 0, len(files))
	for name, content := range files {
		manifest = append(manifest, map[string]any{"name": name, "size": len(content)})
	}
	manifestBytes, _ := json.Marshal(manifest)
	_ = writer.WriteField("manifest", string(manifestBytes))
	for name, content := range files {
		part, _ := writer.CreateFormFile("files", name)
		_, _ = part.Write([]byte(content))
	}
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/files/upload?path="+path, &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-Volum-Request", "fetch")
	if ts.cookie != "" {
		req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	}
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
}

func (ts *testServer) uploadAvatar(t *testing.T, content []byte, filename string) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("avatar", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/profile/avatar", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
}

func (ts *testServer) get(path string) *http.Response {
	return ts.request(http.MethodGet, path, nil)
}

func (ts *testServer) post(path string, body any) *http.Response {
	return ts.request(http.MethodPost, path, body)
}

func (ts *testServer) patch(path string, body any) *http.Response {
	return ts.request(http.MethodPatch, path, body)
}

func (ts *testServer) del(path string, body any) *http.Response {
	return ts.request(http.MethodDelete, path, body)
}

func readJSON(t *testing.T, resp *http.Response, dest any) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(dest); err != nil {
		t.Fatal(err)
	}
}
