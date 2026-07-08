package worker

import (
	"context"
	"os"
	"path/filepath"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func walkWithJobControl(
	store *jobs.Store,
	ctx context.Context,
	jobID, source string,
	fn func(path, rel string, entry os.DirEntry) error,
) error {
	return filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		cancelled, _ := store.IsCancelled(ctx, jobID)
		if cancelled {
			return nil
		}
		paused, _ := store.IsPaused(ctx, jobID)
		if paused {
			return errJobPaused
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}

		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		return fn(path, rel, entry)
	})
}
