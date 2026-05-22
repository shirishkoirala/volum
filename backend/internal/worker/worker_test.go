package worker

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/storage"
)

func setupWorker(t *testing.T, root string) (*Worker, *jobs.Store, context.Context) {
	t.Helper()
	ctx := context.Background()
	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	store := jobs.NewStore(db)
	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	w := New(store, guard, slog.New(slog.NewTextHandler(io.Discard, nil)))
	return w, store, ctx
}

func TestProcessTransferResumesPartialFile(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	source := filepath.Join(root, "source.txt")
	destination := filepath.Join(root, "destination.txt")
	temp := filepath.Join(root, ".volum-tmp", "destination.txt.partial")
	content := []byte("hello world")

	if err := os.WriteFile(source, content, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(temp), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(temp, content[:5], 0o644); err != nil {
		t.Fatal(err)
	}

	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := jobs.NewStore(db)
	job, err := store.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeCopy,
		SourcePath:      source,
		DestinationPath: destination,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.StartJob(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	tempPath := temp
	if _, err := store.CreateItem(ctx, jobs.Item{
		JobID:           job.ID,
		SourcePath:      source,
		DestinationPath: destination,
		TempPath:        &tempPath,
		SizeBytes:       int64(len(content)),
		ProcessedBytes:  5,
		Status:          jobs.StatusRunning,
	}); err != nil {
		t.Fatal(err)
	}
	job, err = store.Get(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	w := New(store, guard, slog.New(slog.NewTextHandler(io.Discard, nil)))

	if err := w.processTransfer(ctx, job); err != nil {
		t.Fatal(err)
	}

	got, err := os.ReadFile(destination)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(content) {
		t.Fatalf("expected %q, got %q", content, got)
	}
	gotJob, err := store.Get(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotJob.Status != jobs.StatusCompleted {
		t.Fatalf("expected completed job, got %s", gotJob.Status)
	}
}

func TestProcessArchiveZip(t *testing.T) {
	root := t.TempDir()
	srcDir := filepath.Join(root, "src")
	os.MkdirAll(srcDir, 0o755)
	os.WriteFile(filepath.Join(srcDir, "a.txt"), []byte("hello"), 0o644)
	archivePath := filepath.Join(root, "output.zip")

	w, store, ctx := setupWorker(t, root)
	job, err := store.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeArchive,
		SourcePath:      srcDir,
		DestinationPath: archivePath,
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := w.processArchive(ctx, job); err != nil {
		t.Fatal(err)
	}

	r, err := zip.OpenReader(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if len(r.File) != 1 || r.File[0].Name != "a.txt" {
		t.Fatalf("unexpected archive contents: %#v", r.File)
	}
}

func TestProcessArchiveTar(t *testing.T) {
	root := t.TempDir()
	srcDir := filepath.Join(root, "src")
	os.MkdirAll(srcDir, 0o755)
	os.WriteFile(filepath.Join(srcDir, "a.txt"), []byte("hello"), 0o644)
	archivePath := filepath.Join(root, "output.tar")

	w, store, ctx := setupWorker(t, root)
	job, err := store.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeArchive,
		SourcePath:      srcDir,
		DestinationPath: archivePath,
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := w.processArchive(ctx, job); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	tr := tar.NewReader(f)
	hdr, err := tr.Next()
	if err != nil {
		t.Fatal(err)
	}
	if hdr.Name != "a.txt" {
		t.Fatalf("expected a.txt, got %s", hdr.Name)
	}
}

func TestProcessArchiveTarGz(t *testing.T) {
	root := t.TempDir()
	srcDir := filepath.Join(root, "src")
	os.MkdirAll(srcDir, 0o755)
	os.WriteFile(filepath.Join(srcDir, "a.txt"), []byte("hello"), 0o644)
	archivePath := filepath.Join(root, "output.tar.gz")

	w, store, ctx := setupWorker(t, root)
	job, err := store.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeArchive,
		SourcePath:      srcDir,
		DestinationPath: archivePath,
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := w.processArchive(ctx, job); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	gr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	defer gr.Close()
	tr := tar.NewReader(gr)
	hdr, err := tr.Next()
	if err != nil {
		t.Fatal(err)
	}
	if hdr.Name != "a.txt" {
		t.Fatalf("expected a.txt, got %s", hdr.Name)
	}
}

func TestProcessExtractZip(t *testing.T) {
	root := t.TempDir()
	destDir := filepath.Join(root, "out")
	archivePath := filepath.Join(root, "archive.zip")

	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	w, _ := zw.Create("file.txt")
	w.Write([]byte("extracted"))
	zw.Close()

	if err := os.WriteFile(archivePath, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}

	worker, _, ctx := setupWorker(t, root)

	job, err := worker.store.Create(ctx, jobs.CreateRequest{
		Type:            jobs.TypeExtract,
		SourcePath:      archivePath,
		DestinationPath: destDir,
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := worker.processExtract(ctx, job); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(filepath.Join(destDir, "file.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "extracted" {
		t.Fatalf("expected 'extracted', got %s", string(data))
	}
}

func TestProcessChecksumSha256(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "data.bin")
	if err := os.WriteFile(filePath, []byte("test data"), 0o644); err != nil {
		t.Fatal(err)
	}

	w, store, ctx := setupWorker(t, root)
	job, err := store.Create(ctx, jobs.CreateRequest{
		Type:       jobs.TypeChecksum,
		SourcePath: filePath,
		VerifyMode: "sha256",
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := w.processChecksum(ctx, job); err != nil {
		t.Fatal(err)
	}

	got, _ := store.Get(ctx, job.ID)
	if got.Status != jobs.StatusCompleted {
		t.Fatalf("expected completed, got %s", got.Status)
	}
}

func TestProcessChecksumMd5(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "data.bin")
	if err := os.WriteFile(filePath, []byte("test data"), 0o644); err != nil {
		t.Fatal(err)
	}

	w, store, ctx := setupWorker(t, root)
	job, err := store.Create(ctx, jobs.CreateRequest{
		Type:       jobs.TypeChecksum,
		SourcePath: filePath,
		VerifyMode: "md5",
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := w.processChecksum(ctx, job); err != nil {
		t.Fatal(err)
	}

	got, _ := store.Get(ctx, job.ID)
	if got.Status != jobs.StatusCompleted {
		t.Fatalf("expected completed, got %s", got.Status)
	}
}

func TestArchiveFormatDetection(t *testing.T) {
	tests := []struct {
		name     string
		expected string
	}{
		{"file.zip", "zip"},
		{"file.tar", "tar"},
		{"file.tar.gz", "tar.gz"},
		{"file.tgz", "tar.gz"},
		{"file.txt", ""},
	}
	for _, tt := range tests {
		got := ArchiveFormat(tt.name)
		if got != tt.expected {
			t.Errorf("ArchiveFormat(%q) = %q, want %q", tt.name, got, tt.expected)
		}
	}
}

func TestIsTarArchive(t *testing.T) {
	tests := []struct {
		name     string
		expected bool
	}{
		{"file.tar", true},
		{"file.tar.gz", true},
		{"file.tgz", true},
		{"file.zip", false},
		{"file.txt", false},
	}
	for _, tt := range tests {
		got := isTarArchive(tt.name)
		if got != tt.expected {
			t.Errorf("isTarArchive(%q) = %v, want %v", tt.name, got, tt.expected)
		}
	}
}

func TestArchiveBaseFromName(t *testing.T) {
	tests := []struct {
		name     string
		expected string
	}{
		{"test.tar.gz", "test"},
		{"test.tgz", "test"},
		{"test.tar", "test"},
		{"test.zip", "test"},
		{"test.txt", "test.txt"},
	}
	for _, tt := range tests {
		got := archiveBaseFromName(tt.name)
		if got != tt.expected {
			t.Errorf("archiveBaseFromName(%q) = %q, want %q", tt.name, got, tt.expected)
		}
	}
}
