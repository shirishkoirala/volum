package api

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/volum-app/volum/backend/internal/files"
)

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
