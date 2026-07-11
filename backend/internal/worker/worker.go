package worker

import (
	"context"
	"log/slog"
	"time"

	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

type Worker struct {
	store *jobs.Store
	guard *security.RootGuard
	files *files.Service
	log   *slog.Logger
}

func New(store *jobs.Store, guard *security.RootGuard, log *slog.Logger) *Worker {
	return &Worker{store: store, guard: guard, files: files.NewService(guard, files.NewDirSizeCache(5*time.Minute)), log: log}
}

func (w *Worker) Recover(ctx context.Context) error {
	return w.store.MarkInterruptedRunningJobs(ctx)
}

func (w *Worker) Start(ctx context.Context) {
	w.log.Info("worker started")
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.log.Info("worker stopped")
			return
		case <-ticker.C:
			w.runOnce(ctx)
		}
	}
}

func (w *Worker) runOnce(ctx context.Context) {
	job, ok, err := w.store.ClaimNextTrashJob(ctx)
	if err != nil {
		w.log.Error("claim trash job failed", "error", err)
		return
	}
	if ok {
		if err := w.processTrash(ctx, job); err != nil {
			w.log.Error("trash job failed", "job_id", job.ID, "error", err)
			_ = w.store.FailJob(ctx, job.ID, err)
		}
		return
	}

	job, ok, err = w.store.ClaimNextTransferJob(ctx)
	if err != nil {
		w.log.Error("claim transfer job failed", "error", err)
		return
	}
	if ok {
		if err := w.processTransfer(ctx, job); err != nil {
			w.log.Error("transfer job failed", "job_id", job.ID, "error", err)
			if failErr := w.store.FailJob(ctx, job.ID, err); failErr != nil {
				w.log.Error("mark transfer job failed", "job_id", job.ID, "error", failErr)
			}
		}
		return
	}

	job, ok, err = w.store.ClaimNextArchiveJob(ctx)
	if err != nil {
		w.log.Error("claim archive job failed", "error", err)
		return
	}
	if ok {
		var processErr error
		switch job.Type {
		case jobs.TypeArchive:
			_, processErr = w.processArchive(ctx, job)
		case jobs.TypeExtract:
			_, processErr = w.processExtract(ctx, job)
		}
		if processErr != nil {
			w.log.Error("archive/extract job failed", "job_id", job.ID, "error", processErr)
			if failErr := w.store.FailJob(ctx, job.ID, processErr); failErr != nil {
				w.log.Error("mark job failed", "job_id", job.ID, "error", failErr)
			}
		}
		return
	}

	job, ok, err = w.store.ClaimNextChecksumJob(ctx)
	if err != nil {
		w.log.Error("claim checksum job failed", "error", err)
		return
	}
	if !ok {
		return
	}
	if err := w.processChecksum(ctx, job); err != nil {
		w.log.Error("checksum job failed", "job_id", job.ID, "error", err)
		if failErr := w.store.FailJob(ctx, job.ID, err); failErr != nil {
			w.log.Error("mark checksum job failed", "job_id", job.ID, "error", failErr)
		}
	}
}
