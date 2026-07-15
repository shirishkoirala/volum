package jobs

import "testing"

func TestDiskUsageSummaryUsesRootResult(t *testing.T) {
	store, ctx := setupStore(t)
	job := createTestJob(t, store, ctx, TypeDiskAnalyze)

	err := store.InsertDiskUsageResults(ctx, []DiskUsageResult{
		{JobID: job.ID, Path: "/storage", ParentPath: "", SizeBytes: 100, FileCount: 2, DirCount: 1},
		{JobID: job.ID, Path: "/storage/child", ParentPath: "/storage", SizeBytes: 40, FileCount: 1},
	})
	if err != nil {
		t.Fatal(err)
	}

	summary, err := store.GetDiskUsageSummary(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if summary.TotalBytes != 100 || summary.FileCount != 2 || summary.DirectoryCount != 1 {
		t.Fatalf("unexpected summary: %#v", summary)
	}
}
