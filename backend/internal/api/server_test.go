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
	"os"
	"path/filepath"
	"testing"

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
	s := New(filesService, jobStore, guard, authService, authStore, shareStore, desktopStore, healthChecker, filepath.Join(root, "volum.db"))

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

func TestServiceHealthEndpoint(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	healthyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer healthyServer.Close()

	unhealthyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer unhealthyServer.Close()

	createHealthy := ts.post("/api/services", map[string]string{
		"name":      "Healthy",
		"url":       healthyServer.URL,
		"healthUrl": healthyServer.URL + "/health",
	})
	if createHealthy.StatusCode != http.StatusCreated {
		t.Fatalf("expected healthy service create 201, got %d", createHealthy.StatusCode)
	}
	var healthySvc desktop.ServiceRecord
	readJSON(t, createHealthy, &healthySvc)

	createUnhealthy := ts.post("/api/services", map[string]string{
		"name":      "Unhealthy",
		"url":       unhealthyServer.URL,
		"healthUrl": unhealthyServer.URL + "/health",
	})
	if createUnhealthy.StatusCode != http.StatusCreated {
		t.Fatalf("expected unhealthy service create 201, got %d", createUnhealthy.StatusCode)
	}
	var unhealthySvc desktop.ServiceRecord
	readJSON(t, createUnhealthy, &unhealthySvc)

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

	if body[healthySvc.ID].Status != "healthy" || body[healthySvc.ID].StatusCode != http.StatusNoContent {
		t.Fatalf("expected healthy result, got %#v", body[healthySvc.ID])
	}
	if body[unhealthySvc.ID].Status != "unhealthy" || body[unhealthySvc.ID].StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected unhealthy result, got %#v", body[unhealthySvc.ID])
	}
	if _, ok := body[uncheckedSvc.ID]; ok {
		t.Fatal("did not expect service without health URL in health response")
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
