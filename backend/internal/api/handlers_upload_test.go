package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

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

	resp := ts.upload(ts.root, map[string]string{"subdir/file.txt": "data"})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", resp.StatusCode, readBody(resp))
	}
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

func TestUploadChunkResumesAndFinalizesSpecialCharacterFilename(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	filename := "résumé + notes.txt"
	content := "hello resumed upload"
	firstChunk := content[:6]
	secondChunk := content[6:]

	params := url.Values{}
	params.Set("path", ts.root)
	params.Set("filename", filename)
	params.Set("offset", "0")
	params.Set("totalSize", strconv.Itoa(len(content)))
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload-chunk?"+params.Encode(), strings.NewReader(firstChunk))
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w := httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected first chunk 200, got %d; body: %s", w.Code, w.Body.String())
	}
	var firstResp struct {
		Received int64  `json:"received"`
		Complete bool   `json:"complete"`
		JobID    string `json:"jobId"`
	}
	if err := json.NewDecoder(w.Result().Body).Decode(&firstResp); err != nil {
		t.Fatal(err)
	}
	if firstResp.Received != int64(len(firstChunk)) || firstResp.Complete || firstResp.JobID == "" {
		t.Fatalf("unexpected first chunk response: %+v", firstResp)
	}

	statusParams := url.Values{}
	statusParams.Set("path", ts.root)
	statusParams.Set("filename", filename)
	statusReq := httptest.NewRequest(http.MethodGet, "/api/files/upload-status?"+statusParams.Encode(), nil)
	statusReq.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	statusW := httptest.NewRecorder()
	ts.Handler().ServeHTTP(statusW, statusReq)
	if statusW.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", statusW.Code, statusW.Body.String())
	}
	var statusResp struct {
		Filename string `json:"filename"`
		Received int64  `json:"received"`
		Complete bool   `json:"complete"`
		JobID    string `json:"jobId"`
	}
	if err := json.NewDecoder(statusW.Result().Body).Decode(&statusResp); err != nil {
		t.Fatal(err)
	}
	if statusResp.Filename != filename || statusResp.Received != int64(len(firstChunk)) || statusResp.Complete || statusResp.JobID != firstResp.JobID {
		t.Fatalf("unexpected upload status response: %+v", statusResp)
	}

	params.Set("offset", strconv.Itoa(len(firstChunk)))
	params.Set("jobId", firstResp.JobID)
	req = httptest.NewRequest(http.MethodPost, "/api/files/upload-chunk?"+params.Encode(), strings.NewReader(secondChunk))
	req.Header.Set("X-Volum-Request", "fetch")
	req.AddCookie(&http.Cookie{Name: "volum_session", Value: ts.cookie})
	w = httptest.NewRecorder()
	ts.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected final chunk 200, got %d; body: %s", w.Code, w.Body.String())
	}
	var finalResp struct {
		Received int64  `json:"received"`
		Complete bool   `json:"complete"`
		JobID    string `json:"jobId"`
	}
	if err := json.NewDecoder(w.Result().Body).Decode(&finalResp); err != nil {
		t.Fatal(err)
	}
	if finalResp.Received != int64(len(content)) || !finalResp.Complete || finalResp.JobID != firstResp.JobID {
		t.Fatalf("unexpected final chunk response: %+v", finalResp)
	}

	got, err := os.ReadFile(filepath.Join(ts.root, filename))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != content {
		t.Fatalf("unexpected uploaded content: %q", got)
	}
	if _, err := os.Stat(filepath.Join(ts.root, ".volum-tmp", filename+".partial")); !os.IsNotExist(err) {
		t.Fatal("partial upload file should be cleaned up after finalization")
	}
	if _, err := os.Stat(filepath.Join(ts.root, ".volum-tmp", filename+".jobid")); !os.IsNotExist(err) {
		t.Fatal("upload job state should be cleaned up after finalization")
	}
}
