package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/shares"
	"github.com/volum-app/volum/backend/internal/storage"
	"github.com/volum-app/volum/backend/internal/worker"
)

type testServer struct {
	*Server
	root string
	db   *sql.DB
}

func setupTestServer(t *testing.T) (*testServer, func()) {
	t.Helper()
	root := t.TempDir()

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}

	authService, err := auth.New("", "", "")
	if err != nil {
		t.Fatal(err)
	}

	filesService := files.NewService(guard, files.NewDirSizeCache(0))

	db, err := storage.Open(filepath.Join(root, "volum.db"))
	if err != nil {
		t.Fatal(err)
	}

	jobStore := jobs.NewStore(db)
	shareStore := shares.NewStore(db)

	slogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	workerService := worker.New(jobStore, guard, slogger)

	_ = workerService

	s := New(filesService, jobStore, guard, authService, shareStore, filepath.Join(root, "volum.db"))

	ts := &testServer{Server: s, root: root}

	return ts, func() {
		db.Close()
	}
}

func (ts *testServer) get(path string) *http.Response {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
}

func (ts *testServer) post(path string, body any) *http.Response {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(http.MethodPost, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
}

func (ts *testServer) patch(path string, body any) *http.Response {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(http.MethodPatch, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
}

func (ts *testServer) del(path string, body any) *http.Response {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(http.MethodDelete, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	ts.Server.Handler().ServeHTTP(w, req)
	return w.Result()
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
		Role          string `json:"role"`
	}
	readJSON(t, resp, &body)
	if body.AuthEnabled || !body.Authenticated || body.Role != "admin" {
		t.Fatalf("unexpected session: %#v", body)
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
