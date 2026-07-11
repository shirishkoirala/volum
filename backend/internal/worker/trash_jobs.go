package worker

import (
	"context"
	"errors"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func (w *Worker) processTrash(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil || *job.SourcePath == "" {
		return errors.New("trash job requires a source path")
	}

	switch job.Type {
	case jobs.TypeTrash:
		entry, err := w.files.TrashWithID(*job.SourcePath, job.ID)
		if err != nil {
			return err
		}
		if err := w.store.CreateAuditLog(ctx, "trash", *job.SourcePath, "moved to trash "+entry.ID); err != nil {
			return err
		}
	case jobs.TypeRestore:
		entry, err := w.files.RestoreTrashRetry(*job.SourcePath)
		if err != nil {
			return err
		}
		if err := w.store.CreateAuditLog(ctx, "restore", entry.Path, "restored from trash"); err != nil {
			return err
		}
	default:
		return errors.New("unsupported trash job type")
	}

	return w.store.CompleteJob(ctx, job.ID)
}
