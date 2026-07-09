package api

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/jobs"
)

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
