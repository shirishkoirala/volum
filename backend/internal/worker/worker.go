package worker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
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
	job, ok, err := w.store.ClaimNextTransferJob(ctx)
	if err != nil {
		w.log.Error("claim transfer job failed", "error", err)
		return
	}
	if !ok {
		return
	}

	if err := w.processTransfer(ctx, job); err != nil {
		w.log.Error("transfer job failed", "job_id", job.ID, "error", err)
		if failErr := w.store.FailJob(ctx, job.ID, err); failErr != nil {
			w.log.Error("mark transfer job failed", "job_id", job.ID, "error", failErr)
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

func (w *Worker) processTransfer(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil || job.DestinationPath == nil {
		return errors.New("transfer job requires source and destination paths")
	}
	if job.Type == jobs.TypeMove && job.ConflictPolicy == "skip" {
		return errors.New("skip conflict policy is not supported for move jobs")
	}

	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return err
	}
	destination, err := w.guard.Resolve(*job.DestinationPath)
	if err != nil {
		return err
	}
	if job.Type == jobs.TypeMove && w.isRoot(source) {
		return errors.New("operation is not allowed on a configured root")
	}
	if containsPath(source, destination) {
		return errors.New("destination cannot be inside the source path")
	}
	if policy := job.ConflictPolicy; policy == "cancel" {
		return errors.New("transfer cancelled by conflict policy")
	} else if resolvedDestination, err := w.resolveConflictDestination(ctx, destination, policy); err != nil {
		if errors.Is(err, errSkipDestination) {
			return w.store.CompleteJob(ctx, job.ID)
		}
		return err
	} else {
		destination = resolvedDestination
	}

	items, err := w.planCopy(source, destination)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		if err := os.MkdirAll(destination, 0o755); err != nil {
			return err
		}
		if err := w.finishMove(ctx, job, source); err != nil {
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

		copied, err := w.copyOne(ctx, job, item, processedBytes, processedItems)
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

	if err := w.finishMove(ctx, job, source); err != nil {
		return err
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

func (w *Worker) copyOne(ctx context.Context, job jobs.Job, item copyItem, baseBytes, processedItems int64) (int64, error) {
	if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, 0, nil); err != nil {
		return 0, err
	}
	if policy := job.ConflictPolicy; policy == "cancel" {
		return 0, errors.New("transfer cancelled by conflict policy")
	} else if destination, err := w.resolveConflictDestination(ctx, item.Destination, policy); err != nil {
		if errors.Is(err, errSkipDestination) {
			return 0, nil
		}
		return 0, err
	} else {
		item.Destination = destination
		item.Temp = filepath.Join(filepath.Dir(item.Destination), ".volum-tmp", filepath.Base(item.Destination)+".partial")
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
		cancelled, err := w.store.IsCancelled(ctx, job.ID)
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
			if err := w.store.UpdateJobProgress(ctx, job.ID, baseBytes+copied, processedItems, item.Source); err != nil {
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

var errSkipDestination = errors.New("destination skipped by conflict policy")

func (w *Worker) resolveConflictDestination(ctx context.Context, destination, policy string) (string, error) {
	if policy == "" {
		policy = "ask"
	}
	if _, err := os.Stat(destination); err == nil {
		switch policy {
		case "skip":
			return "", errSkipDestination
		case "overwrite":
			if err := w.store.CreateAuditLog(ctx, "overwrite", destination, "removed existing destination for transfer job"); err != nil {
				return "", err
			}
			return destination, os.RemoveAll(destination)
		case "rename":
			return nextAvailablePath(destination)
		}
		return "", fmt.Errorf("destination already exists: %s", destination)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	return destination, nil
}

func nextAvailablePath(path string) (string, error) {
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return path, nil
	} else if err != nil {
		return "", err
	}
	ext := filepath.Ext(path)
	base := path[:len(path)-len(ext)]
	for i := 1; i <= 1000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("could not find available name for %s", path)
}

func (w *Worker) finishMove(ctx context.Context, job jobs.Job, source string) error {
	if job.Type != jobs.TypeMove {
		return nil
	}
	if err := os.RemoveAll(source); err != nil {
		return err
	}
	return w.store.CreateAuditLog(ctx, "move", source, fmt.Sprintf("moved to %s", deref(job.DestinationPath)))
}

func (w *Worker) isRoot(path string) bool {
	for _, root := range w.guard.Roots() {
		if path == root {
			return true
		}
	}
	return false
}

func containsPath(parent, child string) bool {
	rel, err := filepath.Rel(parent, child)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
