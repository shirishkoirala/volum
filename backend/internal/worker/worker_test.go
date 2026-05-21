package worker

import (
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
