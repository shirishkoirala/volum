package jobs

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/storage"
)

func setupStore(t *testing.T) (*Store, context.Context) {
	t.Helper()
	ctx := context.Background()
	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db), ctx
}

func createTestJob(t *testing.T, store *Store, ctx context.Context, jobType Type) Job {
	t.Helper()
	job, err := store.Create(ctx, CreateRequest{
		Type:            jobType,
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/dest",
		ConflictPolicy:  "rename",
		VerifyMode:      "size",
	})
	if err != nil {
		t.Fatal(err)
	}
	return job
}

func TestCreateAndGetJob(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	got, err := store.Get(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != job.ID || got.Type != TypeCopy || got.Status != StatusQueued {
		t.Fatalf("unexpected job: %#v", got)
	}
}

func TestListJobs(t *testing.T) {
	store, ctx := setupStore(t)
	createTestJob(t, store, ctx, TypeCopy)
	createTestJob(t, store, ctx, TypeArchive)

	jobs, err := store.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(jobs))
	}
}

func TestCancelJob(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	if err := store.Cancel(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	got, _ := store.Get(ctx, job.ID)
	if got.Status != StatusCancelled {
		t.Fatalf("expected cancelled, got %s", got.Status)
	}
}

func TestRetryJob(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	if err := store.FailJob(ctx, job.ID, errors.New("test error")); err != nil {
		t.Fatal(err)
	}
	if err := store.Retry(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	got, _ := store.Get(ctx, job.ID)
	if got.Status != StatusQueued {
		t.Fatalf("expected queued after retry, got %s", got.Status)
	}
}

func TestPauseResumeJob(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	if err := store.StartJob(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.PauseJob(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.ResumeJob(ctx, job.ID); err != nil {
		t.Fatal(err)
	}
	got, _ := store.Get(ctx, job.ID)
	if got.Status != StatusQueued {
		t.Fatalf("expected queued after resume, got %s", got.Status)
	}
}

func TestClearCompleted(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)
	if err := store.CompleteJob(ctx, job.ID); err != nil {
		t.Fatal(err)
	}

	removed, err := store.ClearCompleted(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if removed == 0 {
		t.Fatal("expected removed count > 0")
	}
}

func TestClearFailed(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)
	if err := store.FailJob(ctx, job.ID, errors.New("test error")); err != nil {
		t.Fatal(err)
	}

	removed, err := store.ClearFailed(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if removed == 0 {
		t.Fatal("expected removed count > 0")
	}
}

func TestItemCRUD(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	item, err := store.CreateItem(ctx, Item{
		JobID:           job.ID,
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/dest",
		SizeBytes:       100,
		Status:          StatusQueued,
	})
	if err != nil {
		t.Fatal(err)
	}
	if item.ID == "" {
		t.Fatal("expected item ID")
	}

	if err := store.UpdateItemStatus(ctx, item.ID, StatusRunning, 50, nil); err != nil {
		t.Fatal(err)
	}

	items, err := store.ListItems(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ProcessedBytes != 50 {
		t.Fatalf("unexpected items: %#v", items)
	}
}

func TestRetryItem(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	item, err := store.CreateItem(ctx, Item{
		JobID:           job.ID,
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/dest",
		SizeBytes:       100,
		Status:          StatusFailed,
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := store.RetryItem(ctx, job.ID, item.ID); err != nil {
		t.Fatal(err)
	}

	items, _ := store.ListItems(ctx, job.ID)
	if items[0].Status != StatusQueued {
		t.Fatalf("expected queued, got %s", items[0].Status)
	}
}

func TestClaimNextTransferJob(t *testing.T) {
	store, ctx := setupStore(t)
	createTestJob(t, store, ctx, TypeCopy)
	createTestJob(t, store, ctx, TypeMove)

	claimed, ok, err := store.ClaimNextTransferJob(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected to claim a job")
	}
	if claimed.Type != TypeCopy {
		t.Fatalf("expected copy job first (FIFO), got %s", claimed.Type)
	}

	claimed2, ok, err := store.ClaimNextTransferJob(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !ok || claimed2.Type != TypeMove {
		t.Fatalf("expected move job, got %s", claimed2.Type)
	}
}

func TestClaimNextArchiveJob(t *testing.T) {
	store, ctx := setupStore(t)
	createTestJob(t, store, ctx, TypeArchive)
	createTestJob(t, store, ctx, TypeExtract)

	_, ok, err := store.ClaimNextArchiveJob(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected to claim an archive job")
	}

	claimed2, ok, err := store.ClaimNextArchiveJob(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !ok || claimed2.Type != TypeExtract {
		t.Fatalf("expected extract job, got %s", claimed2.Type)
	}
}

func TestClaimNextChecksumJob(t *testing.T) {
	store, ctx := setupStore(t)
	createTestJob(t, store, ctx, TypeChecksum)

	claimed, ok, err := store.ClaimNextChecksumJob(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !ok || claimed.Type != TypeChecksum {
		t.Fatalf("expected checksum job, got %+v", claimed)
	}
}

func TestJobChaining(t *testing.T) {
	store, ctx := setupStore(t)
	first := createTestJob(t, store, ctx, TypeCopy)
	second := createTestJob(t, store, ctx, TypeArchive)

	if err := store.SetNextJob(ctx, first.ID, second.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.CompleteJob(ctx, first.ID); err != nil {
		t.Fatal(err)
	}

	got, _ := store.Get(ctx, second.ID)
	if got.Status != StatusQueued {
		t.Fatalf("expected second job queued via chaining, got %s", got.Status)
	}
}

func TestProgressAndTotals(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeCopy)

	if err := store.SetJobTotals(ctx, job.ID, 1000, 10); err != nil {
		t.Fatal(err)
	}
	if err := store.UpdateJobProgress(ctx, job.ID, 500, 5, "/tmp/source"); err != nil {
		t.Fatal(err)
	}

	got, _ := store.Get(ctx, job.ID)
	if got.TotalBytes != 1000 || got.ProcessedBytes != 500 {
		t.Fatalf("unexpected progress: %+v", got)
	}
}

func TestMarkInterruptedRunningJobsRequeuesTransferJobs(t *testing.T) {
	store, ctx := setupStore(t)

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

func TestAuditLog(t *testing.T) {
	store, ctx := setupStore(t)

	if err := store.CreateAuditLog(ctx, "test", "/tmp/path", "test action"); err != nil {
		t.Fatal(err)
	}
}

func TestCreateInvalidType(t *testing.T) {
	store, ctx := setupStore(t)

	_, err := store.Create(ctx, CreateRequest{
		Type:            "",
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/dest",
	})
	if err == nil {
		t.Fatal("expected error for empty type")
	}
}

func TestCreateInvalidConflictPolicy(t *testing.T) {
	store, ctx := setupStore(t)

	_, err := store.Create(ctx, CreateRequest{
		Type:            TypeCopy,
		SourcePath:      "/tmp/source",
		DestinationPath: "/tmp/dest",
		ConflictPolicy:  "invalid",
	})
	if err != ErrInvalidConflictPolicy {
		t.Fatalf("expected ErrInvalidConflictPolicy, got %v", err)
	}
}

func TestCancelNonExistentJob(t *testing.T) {
	store, ctx := setupStore(t)

	if err := store.Cancel(ctx, "nonexistent"); err == nil {
		t.Fatal("expected error for nonexistent job")
	}
}
