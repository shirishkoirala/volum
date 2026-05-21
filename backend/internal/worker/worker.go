package worker

import (
	"context"
	"log/slog"

	"github.com/volum-app/volum/backend/internal/jobs"
)

type Worker struct {
	store *jobs.Store
	log   *slog.Logger
}

func New(store *jobs.Store, log *slog.Logger) *Worker {
	return &Worker{store: store, log: log}
}

func (w *Worker) Recover(ctx context.Context) error {
	return w.store.MarkInterruptedRunningJobs(ctx)
}

func (w *Worker) Start(ctx context.Context) {
	w.log.Info("worker started")
	<-ctx.Done()
	w.log.Info("worker stopped")
}
