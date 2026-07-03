package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
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
	"github.com/volum-app/volum/backend/internal/worker"
)

type testServer struct {
	*Server
	root   string
	db     *sql.DB
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
	workerService := worker.New(jobStore, guard, slogger)

	_ = workerService

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
		json.NewEncoder(&buf).Encode(body)
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

func TestGetRoots(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.get("/api/roots")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body struct {
		Roots []struct {
			Path string `json:"path"`
		} `json:"roots"`
	}
	readJSON(t, resp, &body)
	if len(body.Roots) != 1 || body.Roots[0].Path != ts.root {
		t.Fatalf("unexpected roots: %#v", body.Roots)
	}
}

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

func TestGetFiles(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	os.WriteFile(filepath.Join(ts.root, "test.txt"), []byte("hello"), 0o644)

	resp := ts.get("/api/files?path=" + ts.root + "&hidden=false")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body struct {
		Entries []files.Entry `json:"entries"`
	}
	readJSON(t, resp, &body)
	// may include volum.db, filter for test.txt
	found := false
	for _, e := range body.Entries {
		if e.Name == "test.txt" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected test.txt in entries, got %#v", body.Entries)
	}
}

func TestGetFilesSupportsPagination(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	for _, name := range []string{"b.txt", "a.txt", "z.txt", "folder-b", "folder-a"} {
		path := filepath.Join(ts.root, name)
		if filepath.Ext(name) == "" {
			if err := os.MkdirAll(path, 0o755); err != nil {
				t.Fatal(err)
			}
		} else if err := os.WriteFile(path, []byte("data"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	resp := ts.get("/api/files?path=" + ts.root + "&hidden=false&limit=2&offset=1")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body struct {
		Entries []files.Entry `json:"entries"`
		Total   int           `json:"total"`
		Limit   int           `json:"limit"`
		Offset  int           `json:"offset"`
		HasMore bool          `json:"hasMore"`
	}
	readJSON(t, resp, &body)

	if body.Total < 5 || body.Limit != 2 || body.Offset != 1 || !body.HasMore {
		t.Fatalf("unexpected pagination metadata: %#v", body)
	}
	if len(body.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %#v", body.Entries)
	}
	if body.Entries[0].Name != "folder-b" || body.Entries[1].Name != "a.txt" {
		t.Fatalf("unexpected page entries: %#v", body.Entries)
	}
}

func TestCreateFolder(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.post("/api/files/folder", map[string]string{
		"path": ts.root,
		"name": "newdir",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	info, err := os.Stat(filepath.Join(ts.root, "newdir"))
	if err != nil {
		t.Fatal(err)
	}
	if !info.IsDir() {
		t.Fatal("expected directory")
	}
}

func TestUploadFile(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.upload(ts.root, map[string]string{"upload.txt": "uploaded content"})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
	content, err := os.ReadFile(filepath.Join(ts.root, "upload.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "uploaded content" {
		t.Fatalf("unexpected uploaded content: %q", content)
	}
}

func TestUploadSpecialCharacters(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	tests := []struct {
		name    string
		content string
	}{
		{"hello world.txt", "spaces"},
		{"résumé.pdf", "accented"},
		{"照片.jpg", "chinese"},
		{"file-with-dashes_and.dots.txt", "mixed"},
		{"foo bar baz (1).txt", "parentheses"},
		{"a+b=c.txt", "plus and equals"},
		{"file@#$%.txt", "symbols"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := ts.upload(ts.root, map[string]string{tt.name: tt.content})
			if resp.StatusCode != http.StatusCreated {
				t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
			}
			got, err := os.ReadFile(filepath.Join(ts.root, tt.name))
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != tt.content {
				t.Fatalf("expected %q, got %q", tt.content, got)
			}
		})
	}
}

func TestUploadLeadingTrailingSpaces(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.upload(ts.root, map[string]string{"  spaced.txt": "data"})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
	// validUploadName trims spaces, so the actual file is "spaced.txt"
	if _, err := os.Stat(filepath.Join(ts.root, "  spaced.txt")); !os.IsNotExist(err) {
		t.Fatal("leading-space filename should have been trimmed")
	}
	if _, err := os.Stat(filepath.Join(ts.root, "spaced.txt")); err != nil {
		t.Fatal("trimmed filename 'spaced.txt' should exist")
	}
}

func TestUploadPathNormalization(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	// "folder/file.txt" is normalized to "file.txt" via filepath.Base
	resp := ts.upload(ts.root, map[string]string{"subdir/file.txt": "data"})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
	// Should land at root/file.txt, not root/subdir/file.txt
	if _, err := os.Stat(filepath.Join(ts.root, "file.txt")); err != nil {
		t.Fatal("normalized filename 'file.txt' should exist")
	}
}

func TestUploadInvalidNameRejection(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	tests := []struct {
		name string
		desc string
	}{
		{"folder\\file.txt", "backslash"},
		{".", "dot only"},
		{"..", "dotdot only"},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			resp := ts.upload(ts.root, map[string]string{tt.name: "x"})
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d; body: %s", resp.StatusCode, readBody(resp))
			}
		})
	}
}

func TestUploadChunkRejectsOversizedTotal(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	params := url.Values{}
	params.Set("path", ts.root)
	params.Set("filename", "big.bin")
	params.Set("offset", "0")
	params.Set("totalSize", strconv.FormatInt(maxAggregateUploadBytes+1, 10))
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload-chunk?"+params.Encode(), strings.NewReader("data"))
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected oversized total to return 400, got %d", w.Code)
	}
}

func TestUploadChunkRejectsChunkPastTotal(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	params := url.Values{}
	params.Set("path", ts.root)
	params.Set("filename", "chunk.bin")
	params.Set("offset", "3")
	params.Set("totalSize", "4")
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload-chunk?"+params.Encode(), strings.NewReader("too-large"))
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected chunk past total to return 400, got %d", w.Code)
	}
}

func TestRenameFile(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	os.WriteFile(filepath.Join(ts.root, "old.txt"), []byte("data"), 0o644)

	resp := ts.patch("/api/files/rename", map[string]string{
		"path":    filepath.Join(ts.root, "old.txt"),
		"newName": "new.txt",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if _, err := os.Stat(filepath.Join(ts.root, "old.txt")); !os.IsNotExist(err) {
		t.Fatal("old name should not exist")
	}
	if _, err := os.Stat(filepath.Join(ts.root, "new.txt")); err != nil {
		t.Fatal("new name should exist")
	}
}

func TestChmod(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	path := filepath.Join(ts.root, "file.txt")
	os.WriteFile(path, []byte("data"), 0o644)

	resp := ts.patch("/api/files/permissions", map[string]string{
		"path": path,
		"mode": "rwx------",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var entry files.Entry
	readJSON(t, resp, &entry)
	if entry.Permissions != "-rwx------" {
		t.Fatalf("expected -rwx------, got %s", entry.Permissions)
	}
}

func TestDeleteMovesToTrash(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	path := filepath.Join(ts.root, "todelete.txt")
	os.WriteFile(path, []byte("data"), 0o644)

	resp := ts.del("/api/files", map[string]string{
		"path":        path,
		"confirmName": "todelete.txt",
	})
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("original file should be gone")
	}

	trashResp := ts.get("/api/trash")
	var trashBody struct {
		Entries []files.TrashEntry `json:"entries"`
	}
	readJSON(t, trashResp, &trashBody)
	if len(trashBody.Entries) != 1 || trashBody.Entries[0].Name != "todelete.txt" {
		t.Fatalf("expected trashed file, got %#v", trashBody.Entries)
	}
}

func TestCreateAndGetJob(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	srcPath := filepath.Join(ts.root, "source.txt")
	os.WriteFile(srcPath, []byte("data"), 0o644)

	resp := ts.post("/api/jobs", map[string]string{
		"type":            "copy",
		"sourcePath":      srcPath,
		"destinationPath": filepath.Join(ts.root, "dest.txt"),
		"conflictPolicy":  "rename",
		"verifyMode":      "size",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
	var job jobs.Job
	readJSON(t, resp, &job)
	if job.Type != "copy" || job.Status != "queued" {
		t.Fatalf("unexpected job: %#v", job)
	}

	getResp := ts.get("/api/jobs")
	var listBody struct {
		Jobs []jobs.Job `json:"jobs"`
	}
	readJSON(t, getResp, &listBody)
	if len(listBody.Jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(listBody.Jobs))
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

func TestProfileAvatarLifecycle(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	var pngData bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 40, G: 120, B: 220, A: 255})
	if err := png.Encode(&pngData, img); err != nil {
		t.Fatal(err)
	}

	putResp := ts.uploadAvatar(t, pngData.Bytes(), "avatar.png")
	if putResp.StatusCode != http.StatusOK {
		t.Fatalf("expected avatar upload 200, got %d", putResp.StatusCode)
	}
	var avatarState struct {
		HasAvatar     bool  `json:"hasAvatar"`
		AvatarVersion int64 `json:"avatarVersion"`
	}
	readJSON(t, putResp, &avatarState)
	if !avatarState.HasAvatar || avatarState.AvatarVersion == 0 {
		t.Fatalf("unexpected avatar state: %#v", avatarState)
	}

	getResp := ts.get("/api/profile/avatar")
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected avatar fetch 200, got %d", getResp.StatusCode)
	}
	if getResp.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("expected image/png, got %q", getResp.Header.Get("Content-Type"))
	}
	gotData, err := io.ReadAll(getResp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(gotData, pngData.Bytes()) {
		t.Fatal("fetched avatar does not match upload")
	}

	sessionResp := ts.get("/api/session")
	var session struct {
		HasAvatar bool `json:"hasAvatar"`
	}
	readJSON(t, sessionResp, &session)
	if !session.HasAvatar {
		t.Fatal("expected session to report avatar")
	}

	deleteResp := ts.del("/api/profile/avatar", nil)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected avatar delete 200, got %d", deleteResp.StatusCode)
	}
	deleteResp.Body.Close()
	missingResp := ts.get("/api/profile/avatar")
	missingResp.Body.Close()
	if missingResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected deleted avatar to return 404, got %d", missingResp.StatusCode)
	}
}

func TestProfileAvatarRejectsNonImage(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.uploadAvatar(t, []byte("not an image"), "avatar.txt")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", resp.StatusCode)
	}
}

func TestSearchEndpoint(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	os.WriteFile(filepath.Join(ts.root, "hello.txt"), []byte("content"), 0o644)
	os.WriteFile(filepath.Join(ts.root, "other.txt"), []byte("data"), 0o644)

	resp := ts.get("/api/files/search?q=hello&limit=10")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body struct {
		Results []map[string]any `json:"results"`
	}
	readJSON(t, resp, &body)
	if len(body.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(body.Results))
	}
}

func TestDownloadEndpoint(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	path := filepath.Join(ts.root, "download.txt")
	os.WriteFile(path, []byte("file content"), 0o644)

	resp := ts.get("/api/files/download?path=" + path)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(body) != "file content" {
		t.Fatalf("expected 'file content', got %q", string(body))
	}
}

func TestRawEndpointDoesNotRenderActiveOrUnknownContentInline(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()
	for _, test := range []struct {
		name    string
		content string
	}{
		{name: "attack.html", content: `<script>fetch('/api/session')</script>`},
		{name: "unknown.custom-extension", content: "unknown"},
	} {
		path := filepath.Join(ts.root, test.name)
		if err := os.WriteFile(path, []byte(test.content), 0o644); err != nil {
			t.Fatal(err)
		}
		resp := ts.get("/api/files/raw?path=" + url.QueryEscape(path))
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected raw response 200 for %s, got %d", test.name, resp.StatusCode)
		}
		if !strings.HasPrefix(resp.Header.Get("Content-Disposition"), "attachment") {
			t.Fatalf("expected %s to be an attachment, got %q", test.name, resp.Header.Get("Content-Disposition"))
		}
		if resp.Header.Get("X-Content-Type-Options") != "nosniff" {
			t.Fatalf("expected nosniff for %s", test.name)
		}
		resp.Body.Close()
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

func TestCreateChecksumJob(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	path := filepath.Join(ts.root, "checksum.txt")
	os.WriteFile(path, []byte("test data"), 0o644)

	resp := ts.post("/api/jobs", map[string]string{
		"type":       "checksum",
		"sourcePath": path,
		"verifyMode": "sha256",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
	var job jobs.Job
	readJSON(t, resp, &job)
	if job.Type != "checksum" || job.Status != "queued" {
		t.Fatalf("unexpected job: %#v", job)
	}
}

func readBody(resp *http.Response) string {
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	return string(body)
}
