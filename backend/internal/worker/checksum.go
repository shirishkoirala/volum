package worker

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func (w *Worker) processChecksum(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil {
		return fmt.Errorf("checksum job requires a source path")
	}
	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return err
	}

	mode := job.VerifyMode
	if mode == "" {
		mode = "sha256"
	}

	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if linfo, err := os.Lstat(source); err != nil {
		return err
	} else if linfo.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("symlink checksums are not allowed: %s", source)
	}

	if job.Status == jobs.StatusQueued {
		if err := w.store.StartJob(ctx, job.ID); err != nil {
			return err
		}
	}

	if !info.IsDir() {
		return w.checksumOne(ctx, job.ID, source, mode)
	}

	return w.checksumDir(ctx, job.ID, source, mode)
}

func (w *Worker) checksumOne(ctx context.Context, jobID, source, mode string) error {
	f, err := os.Open(source)
	if err != nil {
		return err
	}
	defer f.Close()

	if err := w.store.SetJobTotals(ctx, jobID, 1, 1); err != nil {
		return err
	}

	checksum, err := hashReader(f, mode)
	if err != nil {
		return err
	}

	if _, err := w.store.CreateItem(ctx, jobs.Item{
		JobID:      jobID,
		SourcePath: source,
		Status:     jobs.StatusCompleted,
		Checksum:   &checksum,
	}); err != nil {
		return err
	}
	if err := w.store.UpdateJobProgress(ctx, jobID, 1, 1, w.publicPath(source)); err != nil {
		return err
	}
	return w.store.CompleteJob(ctx, jobID)
}

func (w *Worker) checksumDir(ctx context.Context, jobID, source, mode string) error {
	var totalItems int64
	err := filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if !entry.IsDir() {
			totalItems++
		}
		return nil
	})
	if err != nil {
		return err
	}

	if err := w.store.SetJobTotals(ctx, jobID, totalItems, totalItems); err != nil {
		return err
	}

	isCancelled, _ := w.store.IsCancelled(ctx, jobID)
	if isCancelled {
		return nil
	}

	var processedItems int64
	cancelled := false
	if err := filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if entry.IsDir() {
			return nil
		}

		isCancelled, _ := w.store.IsCancelled(ctx, jobID)
		if isCancelled {
			cancelled = true
			return nil
		}
		paused, _ := w.store.IsPaused(ctx, jobID)
		if paused {
			return errJobPaused
		}

		f, err := os.Open(path)
		if err != nil {
			return err
		}

		checksum, err := hashReader(f, mode)
		f.Close()
		if err != nil {
			return err
		}

		if _, err := w.store.CreateItem(ctx, jobs.Item{
			JobID:      jobID,
			SourcePath: path,
			Status:     jobs.StatusCompleted,
			Checksum:   &checksum,
		}); err != nil {
			return err
		}
		processedItems++
		if err := w.store.UpdateJobProgress(ctx, jobID, processedItems, processedItems, w.publicPath(path)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}
	if cancelled {
		return nil
	}
	return w.store.CompleteJob(ctx, jobID)
}

func hashFile(path, mode string) (string, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("symlink checksums are not allowed: %s", path)
	}
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	return hashReader(f, mode)
}

func hashReader(r io.Reader, mode string) (string, error) {
	switch mode {
	case "md5":
		h := md5.New()
		if _, err := io.Copy(h, r); err != nil {
			return "", err
		}
		return hex.EncodeToString(h.Sum(nil)), nil
	case "sha256":
		h := sha256.New()
		if _, err := io.Copy(h, r); err != nil {
			return "", err
		}
		return hex.EncodeToString(h.Sum(nil)), nil
	default:
		return "", fmt.Errorf("unsupported checksum mode: %s", mode)
	}
}
