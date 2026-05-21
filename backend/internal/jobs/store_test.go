package jobs

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/storage"
)

func TestMarkInterruptedRunningJobsRequeuesTransferJobs(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := NewStore(db)
	job, err := store.Create(ctx, CreateRequest{
		Type:            TypeCopy,
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/destination",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.StartJob(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CreateItem(ctx, Item{
		JobID:           job.ID,
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/destination",
		SizeBytes:       10,
		ProcessedBytes:  4,
		Status:          StatusRunning,
	}); err != nil {
		t.Fatal(err)
	}

	if err := store.MarkInterruptedRunningJobs(ctx); err != nil {
		t.Fatal(err)
	}

	got, err := store.Get(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != StatusQueued {
		t.Fatalf("expected job status queued, got %s", got.Status)
	}
	if got.ErrorMessage == nil {
		t.Fatal("expected resume message")
	}

	items, err := store.ListItems(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].Status != StatusQueued {
		t.Fatalf("expected item status queued, got %s", items[0].Status)
	}
}
