package worker

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/volum-app/volum/backend/internal/jobs"
)

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
		archivePath, err = w.guard.NextAvailablePath(dest)
		if err != nil {
			return "", err
		}
	}
	if err := w.guard.MkdirAll(filepath.Dir(archivePath), 0o755); err != nil {
		return "", err
	}

	archiveFile, err := w.guard.CreateFile(archivePath, 0o644)
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
		_ = w.guard.Remove(archivePath)
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

func (w *Worker) processExtract(ctx context.Context, job jobs.Job) (result string, resultErr error) {
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
	if _, statErr := os.Stat(dest); statErr == nil {
		dest, err = w.guard.NextAvailablePath(dest)
		if err != nil {
			return "", err
		}
	} else if !errors.Is(statErr, os.ErrNotExist) {
		return "", statErr
	}
	if err := w.guard.MkdirAll(dest, 0o755); err != nil {
		return "", err
	}
	defer func() {
		if resultErr == nil {
			return
		}
		_ = w.guard.RemoveAll(dest)
		action := "extract_failed"
		if errors.Is(resultErr, errExtractLimit) {
			action = "extract_rejected"
		}
		_ = w.store.CreateAuditLog(ctx, action, w.publicPath(dest), resultErr.Error())
	}()
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
