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
	job, ok, err := w.store.ClaimNextTransferJob(ctx)
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
			if _, processErr = w.processArchive(ctx, job); processErr != nil {
			} // processArchive handles job state internally
		case jobs.TypeExtract:
			if _, processErr = w.processExtract(ctx, job); processErr != nil {
			}
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

type copyItem struct {
	ID          string
	Source      string
	Destination string
	Temp        string
	Size        int64
	Processed   int64
	Persisted   bool
}

func (w *Worker) processTransfer(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil || job.DestinationPath == nil {
		return errors.New("transfer job requires source and destination paths")
	}
	if job.Type == jobs.TypeMove && (job.ConflictPolicy == "skip" || job.ConflictPolicy == "skip_identical") {
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
	if job.Type == jobs.TypeMove && w.guard.IsRoot(source) {
		return errors.New("operation is not allowed on a configured root")
	}
	if security.PathInside(source, destination) {
		return errors.New("destination cannot be inside the source path")
	}
	items, processedBytes, processedItems, err := w.transferItems(ctx, job, source, destination)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		if err := w.finishMove(ctx, job, source); err != nil {
			return err
		}
		return w.store.CompleteJob(ctx, job.ID)
	}

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
			if errors.Is(err, errJobPaused) {
				return nil
			}
			if errors.Is(err, errJobNeedsAttention) {
				return nil
			}
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
		if err := w.store.UpdateJobProgress(ctx, job.ID, processedBytes, processedItems, w.publicPath(item.Source)); err != nil {
			return err
		}
	}

	if err := w.finishMove(ctx, job, source); err != nil {
		return err
	}
	return w.store.CompleteJob(ctx, job.ID)
}

func (w *Worker) transferItems(ctx context.Context, job jobs.Job, source, destination string) ([]copyItem, int64, int64, error) {
	storedItems, err := w.store.ListItems(ctx, job.ID)
	if err != nil {
		return nil, 0, 0, err
	}
	if len(storedItems) > 0 {
		return w.resumeTransferItems(ctx, job.ID, storedItems)
	}

	if policy := job.ConflictPolicy; policy == "cancel" {
		return nil, 0, 0, errors.New("transfer cancelled by conflict policy")
	} else if policy != "ask" {
		if resolvedDestination, err := w.resolveConflictDestination(ctx, source, destination, policy); err != nil {
			if errors.Is(err, errSkipDestination) {
				if err := w.store.CompleteJob(ctx, job.ID); err != nil {
					return nil, 0, 0, err
				}
				return nil, 0, 0, nil
			}
			return nil, 0, 0, err
		} else {
			destination = resolvedDestination
		}
	}

	items, err := w.planCopy(source, destination)
	if err != nil {
		return nil, 0, 0, err
	}
	if len(items) == 0 {
		if err := os.MkdirAll(destination, 0o755); err != nil {
			return nil, 0, 0, err
		}
		return nil, 0, 0, nil
	}

	if err := w.store.ClearItems(ctx, job.ID); err != nil {
		return nil, 0, 0, err
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
			return nil, 0, 0, err
		}
		items[index].ID = stored.ID
	}
	if err := w.store.SetJobTotals(ctx, job.ID, totalBytes, int64(len(items))); err != nil {
		return nil, 0, 0, err
	}
	return items, 0, 0, nil
}

func (w *Worker) resumeTransferItems(ctx context.Context, jobID string, storedItems []jobs.Item) ([]copyItem, int64, int64, error) {
	items := make([]copyItem, 0, len(storedItems))
	var totalBytes int64
	var processedBytes int64
	var processedItems int64

	for _, stored := range storedItems {
		totalBytes += stored.SizeBytes
		if stored.Status == jobs.StatusCompleted {
			info, err := os.Stat(stored.DestinationPath)
			if err != nil {
				return nil, 0, 0, fmt.Errorf("completed destination missing for resume: %s", stored.DestinationPath)
			}
			if info.Size() != stored.SizeBytes {
				return nil, 0, 0, fmt.Errorf("completed destination size mismatch for resume: %s", stored.DestinationPath)
			}
			processedBytes += stored.SizeBytes
			processedItems++
			continue
		}

		item := copyItem{
			ID:          stored.ID,
			Source:      stored.SourcePath,
			Destination: stored.DestinationPath,
			Size:        stored.SizeBytes,
			Persisted:   true,
		}
		if stored.TempPath != nil {
			item.Temp = *stored.TempPath
		} else {
			item.Temp = filepath.Join(filepath.Dir(stored.DestinationPath), ".volum-tmp", filepath.Base(stored.DestinationPath)+".partial")
		}
		partialSize, err := partialFileSize(item.Temp, item.Size)
		if err != nil {
			return nil, 0, 0, err
		}
		item.Processed = partialSize
		if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusQueued, item.Processed, nil); err != nil {
			return nil, 0, 0, err
		}
		items = append(items, item)
	}

	if err := w.store.SetJobTotals(ctx, jobID, totalBytes, int64(len(storedItems))); err != nil {
		return nil, 0, 0, err
	}
	currentItem := ""
	if len(items) > 0 {
		currentItem = w.publicPath(items[0].Source)
	}
	if err := w.store.UpdateJobProgress(ctx, jobID, processedBytes, processedItems, currentItem); err != nil {
		return nil, 0, 0, err
	}
	return items, processedBytes, processedItems, nil
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
	if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, item.Processed, nil); err != nil {
		return 0, err
	}
	if policy := job.ConflictPolicy; policy == "cancel" {
		return 0, errors.New("transfer cancelled by conflict policy")
	} else if !item.Persisted {
		destination, err := w.resolveConflictDestination(ctx, item.Source, item.Destination, policy)
		if err != nil {
			if errors.Is(err, errSkipDestination) {
				return 0, nil
			}
			if errors.Is(err, errAskDestination) {
				errMsg := fmt.Sprintf("destination already exists: %s", item.Destination)
				_ = w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusConflict, 0, &errMsg)
				_ = w.store.NeedsAttention(ctx, job.ID)
				return 0, errJobNeedsAttention
			}
			return 0, err
		}
		item.Destination = destination
		item.Temp = filepath.Join(filepath.Dir(item.Destination), ".volum-tmp", filepath.Base(item.Destination)+".partial")
	} else if item.Processed > 0 {
		partialSize, err := partialFileSize(item.Temp, item.Size)
		if err != nil {
			return 0, err
		}
		if partialSize != item.Processed {
			item.Processed = partialSize
			if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, item.Processed, nil); err != nil {
				return 0, err
			}
		}
	}

	if err := os.MkdirAll(filepath.Dir(item.Temp), 0o755); err != nil {
		return 0, err
	}

	source, err := os.Open(item.Source)
	if err != nil {
		return 0, err
	}
	defer source.Close()
	if item.Processed > 0 {
		if _, err := source.Seek(item.Processed, io.SeekStart); err != nil {
			return 0, err
		}
	}

	flags := os.O_CREATE | os.O_WRONLY
	if item.Processed == 0 {
		flags |= os.O_TRUNC
	}
	temp, err := os.OpenFile(item.Temp, flags, 0o644)
	if err != nil {
		return 0, err
	}
	if item.Processed > 0 {
		if _, err := temp.Seek(item.Processed, io.SeekStart); err != nil {
			temp.Close()
			return 0, err
		}
	}

	buffer := make([]byte, 1024*1024)
	copied := item.Processed
	progress := newProgressThrottle(copied, 16*1024*1024, 500*time.Millisecond)
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
		paused, err := w.store.IsPaused(ctx, job.ID)
		if err != nil {
			temp.Close()
			return copied, err
		}
		if paused {
			temp.Close()
			_ = w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusPaused, copied, nil)
			return copied, errJobPaused
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
			if progress.Ready(copied) {
				if err := w.store.UpdateItemStatus(ctx, item.ID, jobs.StatusRunning, copied, nil); err != nil {
					temp.Close()
					return copied, err
				}
				if err := w.store.UpdateJobProgress(ctx, job.ID, baseBytes+copied, processedItems, w.publicPath(item.Source)); err != nil {
					temp.Close()
					return copied, err
				}
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

func partialFileSize(path string, expectedSize int64) (int64, error) {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	if info.IsDir() {
		return 0, fmt.Errorf("partial path is a directory: %s", path)
	}
	if info.Size() > expectedSize {
		return 0, fmt.Errorf("partial file is larger than source: %s", path)
	}
	return info.Size(), nil
}

var errSkipDestination = errors.New("destination skipped by conflict policy")
var errJobPaused = errors.New("job paused")
var errAskDestination = errors.New("destination already exists; needs user decision")
var errJobNeedsAttention = errors.New("job needs user attention to resolve conflicts")

type progressThrottle struct {
	lastBytes int64
	lastTime  time.Time
	minBytes  int64
	minPeriod time.Duration
}

func newProgressThrottle(startBytes, minBytes int64, minPeriod time.Duration) *progressThrottle {
	return &progressThrottle{
		lastBytes: startBytes,
		lastTime:  time.Now(),
		minBytes:  minBytes,
		minPeriod: minPeriod,
	}
}

func (t *progressThrottle) Ready(currentBytes int64) bool {
	now := time.Now()
	if currentBytes-t.lastBytes < t.minBytes && now.Sub(t.lastTime) < t.minPeriod {
		return false
	}
	t.lastBytes = currentBytes
	t.lastTime = now
	return true
}

func (w *Worker) resolveConflictDestination(ctx context.Context, source, destination, policy string) (string, error) {
	if policy == "" {
		policy = "ask"
	}
	if _, err := os.Stat(destination); err == nil {
		switch policy {
	case "ask":
		return "", errAskDestination
	case "skip":
		return "", errSkipDestination
	case "skip_identical":
		return w.resolveSkipIdentical(ctx, source, destination)
	case "overwrite":
		if err := w.store.CreateAuditLog(ctx, "overwrite", destination, "removed existing destination for transfer job"); err != nil {
			return "", err
		}
		return destination, os.RemoveAll(destination)
	case "rename":
		return security.NextAvailablePath(destination)
	}
	return "", fmt.Errorf("destination already exists: %s", destination)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	return destination, nil
}

func (w *Worker) resolveSkipIdentical(ctx context.Context, source, destination string) (string, error) {
	srcInfo, err := os.Stat(source)
	if err != nil {
		return "", fmt.Errorf("cannot stat source for skip_identical: %w", err)
	}
	dstInfo, err := os.Stat(destination)
	if err != nil {
		return "", fmt.Errorf("cannot stat destination for skip_identical: %w", err)
	}
	if srcInfo.Size() != dstInfo.Size() {
		return "", fmt.Errorf("destination already exists and sizes differ: %s", destination)
	}
	srcHash, err := hashFile(source, "sha256")
	if err != nil {
		return "", fmt.Errorf("cannot hash source for skip_identical: %w", err)
	}
	dstHash, err := hashFile(destination, "sha256")
	if err != nil {
		return "", fmt.Errorf("cannot hash destination for skip_identical: %w", err)
	}
	if srcHash != dstHash {
		return "", fmt.Errorf("destination already exists and checksums differ: %s", destination)
	}
	if err := w.store.CreateAuditLog(ctx, "skip_identical", destination,
		fmt.Sprintf("skipped identical file (sha256: %s)", srcHash)); err != nil {
		return "", err
	}
	return "", errSkipDestination
}

func (w *Worker) finishMove(ctx context.Context, job jobs.Job, source string) error {
	if job.Type != jobs.TypeMove {
		return nil
	}
	if err := os.RemoveAll(source); err != nil {
		return err
	}
	return w.store.CreateAuditLog(ctx, "move", w.publicPath(source), fmt.Sprintf("moved to %s", deref(job.DestinationPath)))
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (w *Worker) publicPath(path string) string {
	publicPath, err := w.guard.PublicPath(path)
	if err != nil {
		return path
	}
	return publicPath
}

func (w *Worker) processArchive(ctx context.Context, job jobs.Job) (string, error) {
	if job.SourcePath == nil || job.DestinationPath == nil {
		return "", errors.New("archive job requires source and destination paths")
	}
	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return "", err
	}
	dest, err := w.guard.Resolve(*job.DestinationPath)
	if err != nil {
		return "", err
	}
	archivePath := dest
	if _, err := os.Stat(dest); err == nil {
		archivePath, err = security.NextAvailablePath(dest)
		if err != nil {
			return "", err
		}
	}
	if err := os.MkdirAll(filepath.Dir(archivePath), 0o755); err != nil {
		return "", err
	}

	archiveFile, err := os.Create(archivePath)
	if err != nil {
		return "", err
	}
	defer archiveFile.Close()

	format := ArchiveFormat(archivePath)
	switch format {
	case "zip":
		if err := writeZip(w.store, ctx, archiveFile, job.ID, source); err != nil {
			return "", err
		}
	case "tar":
		if err := writeTar(w.store, ctx, archiveFile, job.ID, source); err != nil {
			return "", err
		}
	case "tar.gz":
		if err := writeTarGzip(w.store, ctx, archiveFile, job.ID, source); err != nil {
			return "", err
		}
	default:
		archiveFile.Close()
		os.Remove(archivePath)
		return "", fmt.Errorf("unsupported archive format: %s (supported: .zip, .tar, .tar.gz, .tgz)", format)
	}

	info, err := archiveFile.Stat()
	if err != nil {
		return "", err
	}
	if err := w.store.UpdateJobProgress(ctx, job.ID, info.Size(), 1, *job.SourcePath); err != nil {
		return "", err
	}
	if err := w.store.CreateAuditLog(ctx, "archive", w.publicPath(archivePath), "created archive from "+*job.SourcePath); err != nil {
		return "", err
	}
	if err := w.store.CompleteJob(ctx, job.ID); err != nil {
		return "", err
	}
	return archivePath, nil
}

func (w *Worker) processExtract(ctx context.Context, job jobs.Job) (string, error) {
	if job.SourcePath == nil || job.DestinationPath == nil {
		return "", errors.New("extract job requires source and destination paths")
	}
	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return "", err
	}
	dest, err := w.guard.Resolve(*job.DestinationPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return "", err
	}
	format := ArchiveFormat(source)
	switch format {
	case "zip":
		if err := extractZip(w.store, ctx, dest, job.ID, source); err != nil {
			return "", err
		}
	case "tar":
		if err := extractTar(w.store, ctx, dest, job.ID, source); err != nil {
			return "", err
		}
	case "tar.gz":
		if err := extractTarGzip(w.store, ctx, dest, job.ID, source); err != nil {
			return "", err
		}
	default:
		return "", fmt.Errorf("unsupported archive format: %s (supported: .zip, .tar, .tar.gz, .tgz)", format)
	}
	if err := w.store.CreateAuditLog(ctx, "extract", w.publicPath(dest), "extracted from "+*job.SourcePath); err != nil {
		return "", err
	}
	if err := w.store.CompleteJob(ctx, job.ID); err != nil {
		return "", err
	}
	return dest, nil
}
