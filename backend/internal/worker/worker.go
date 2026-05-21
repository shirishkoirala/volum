package worker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

type Worker struct {
	store *jobs.Store
	guard *security.RootGuard
	log   *slog.Logger
}

func New(store *jobs.Store, guard *security.RootGuard, log *slog.Logger) *Worker {
	return &Worker{store: store, guard: guard, log: log}
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
	job, ok, err := w.store.ClaimNextCopyJob(ctx)
	if err != nil {
		w.log.Error("claim copy job failed", "error", err)
		return
	}
	if !ok {
		return
	}

	if err := w.processCopy(ctx, job); err != nil {
		w.log.Error("copy job failed", "job_id", job.ID, "error", err)
		if failErr := w.store.FailJob(ctx, job.ID, err); failErr != nil {
			w.log.Error("mark copy job failed", "job_id", job.ID, "error", failErr)
		}
	}
}

type copyItem struct {
	ID          string
	Source      string
	Destination string
	Temp        string
	Size        int64
}

func (w *Worker) processCopy(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil || job.DestinationPath == nil {
		return errors.New("copy job requires source and destination paths")
	}

	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return err
	}
	destination, err := w.guard.Resolve(*job.DestinationPath)
	if err != nil {
		return err
	}
	if _, err := os.Stat(destination); err == nil {
		return fmt.Errorf("destination already exists: %s", destination)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	items, err := w.planCopy(source, destination)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		if err := os.MkdirAll(destination, 0o755); err != nil {
			return err
		}
		return w.store.CompleteJob(ctx, job.ID)
	}

	if err := w.store.ClearItems(ctx, job.ID); err != nil {
		return err
	}

	var totalBytes int64
	for index, item := range items {
		totalBytes += item.Size
		temp := item.Temp
		stored, err := w.store.CreateItem(ctx, jobs.Item{
			JobID:           job.ID,
			SourcePath:      item.Source,
			DestinationPath: item.Destination,
			TempPath:        &temp,
			SizeBytes:       item.Size,
			Status:          jobs.StatusQueued,
		})
		if err != nil {
			return err
		}
		items[index].ID = stored.ID
	}
	if err := w.store.SetJobTotals(ctx, job.ID, totalBytes, int64(len(items))); err != nil {
		return err
	}

	var processedBytes int64
	var processedItems int64
	for _, item := range items {
		cancelled, err := w.store.IsCancelled(ctx, job.ID)
		if err != nil {
			return err
		}
		if cancelled {
			return nil
		}

		copied, err := w.copyOne(ctx, job.ID, item, processedBytes, processedItems)
		if err != nil {
			message := err.Error()
			_ = w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusFailed, copied, &message)
			return err
		}
		cancelled, err = w.store.IsCancelled(ctx, job.ID)
		if err != nil {
			return err
		}
		if cancelled {
			if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusCancelled, copied, nil); err != nil {
				return err
			}
			return nil
		}
		if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusCompleted, copied, nil); err != nil {
			return err
		}
		processedBytes += copied
		processedItems++
		if err := w.store.UpdateJobProgress(ctx, job.ID, processedBytes, processedItems, item.Source); err != nil {
			return err
		}
	}

	return w.store.CompleteJob(ctx, job.ID)
}

func (w *Worker) planCopy(source, destination string) ([]copyItem, error) {
	info, err := os.Stat(source)
	if err != nil {
		return nil, err
	}

	if !info.IsDir() {
		return []copyItem{newCopyItem(source, destination, info.Size())}, nil
	}

	items := make([]copyItem, 0)
	err = filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, rel)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		items = append(items, newCopyItem(path, target, info.Size()))
		return nil
	})
	if err != nil {
		return nil, err
	}
	return items, nil
}

func newCopyItem(source, destination string, size int64) copyItem {
	tempDir := filepath.Join(filepath.Dir(destination), ".volum-tmp")
	tempName := filepath.Base(destination) + ".partial"
	return copyItem{
		Source:      source,
		Destination: destination,
		Temp:        filepath.Join(tempDir, tempName),
		Size:        size,
	}
}

func (w *Worker) copyOne(ctx context.Context, jobID string, item copyItem, baseBytes, processedItems int64) (int64, error) {
	if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, 0, nil); err != nil {
		return 0, err
	}
	if _, err := os.Stat(item.Destination); err == nil {
		return 0, fmt.Errorf("destination already exists: %s", item.Destination)
	} else if !errors.Is(err, os.ErrNotExist) {
		return 0, err
	}

	if err := os.MkdirAll(filepath.Dir(item.Temp), 0o755); err != nil {
		return 0, err
	}

	source, err := os.Open(item.Source)
	if err != nil {
		return 0, err
	}
	defer source.Close()

	temp, err := os.OpenFile(item.Temp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return 0, err
	}

	buffer := make([]byte, 1024*1024)
	var copied int64
	for {
		if ctx.Err() != nil {
			temp.Close()
			return copied, ctx.Err()
		}
		cancelled, err := w.store.IsCancelled(ctx, jobID)
		if err != nil {
			temp.Close()
			return copied, err
		}
		if cancelled {
			temp.Close()
			return copied, nil
		}

		n, readErr := source.Read(buffer)
		if n > 0 {
			written, writeErr := temp.Write(buffer[:n])
			if writeErr != nil {
				temp.Close()
				return copied, writeErr
			}
			if written != n {
				temp.Close()
				return copied, io.ErrShortWrite
			}
			copied += int64(written)
			if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, copied, nil); err != nil {
				temp.Close()
				return copied, err
			}
			if err := w.store.UpdateJobProgress(ctx, jobID, baseBytes+copied, processedItems, item.Source); err != nil {
				temp.Close()
				return copied, err
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			temp.Close()
			return copied, readErr
		}
	}

	if err := temp.Sync(); err != nil {
		temp.Close()
		return copied, err
	}
	if err := temp.Close(); err != nil {
		return copied, err
	}

	info, err := os.Stat(item.Temp)
	if err != nil {
		return copied, err
	}
	if info.Size() != item.Size {
		return copied, fmt.Errorf("copy verification failed for %s: expected %d bytes, copied %d bytes", item.Source, item.Size, info.Size())
	}

	if err := os.MkdirAll(filepath.Dir(item.Destination), 0o755); err != nil {
		return copied, err
	}
	if err := os.Rename(item.Temp, item.Destination); err != nil {
		return copied, err
	}
	_ = os.Remove(filepath.Dir(item.Temp))
	return copied, nil
}
