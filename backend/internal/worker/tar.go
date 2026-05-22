package worker

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func writeTar(store *jobs.Store, ctx context.Context, writer io.Writer, jobID, source string) error {
	tw := tar.NewWriter(writer)
	defer tw.Close()

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

		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)

		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		copied, err := io.Copy(tw, f)
		if err != nil {
			return err
		}
		_ = store.UpdateJobProgress(ctx, jobID, copied, 0, path)
		return nil
	})
}

func writeTarGzip(store *jobs.Store, ctx context.Context, writer io.Writer, jobID, source string) error {
	gw := gzip.NewWriter(writer)
	defer gw.Close()
	return writeTar(store, ctx, gw, jobID, source)
}

func extractTar(store *jobs.Store, ctx context.Context, dest, jobID, source string) error {
	f, err := os.Open(source)
	if err != nil {
		return err
	}
	defer f.Close()

	return extractTarFromReader(store, ctx, f, dest, jobID)
}

func extractTarGzip(store *jobs.Store, ctx context.Context, dest, jobID, source string) error {
	f, err := os.Open(source)
	if err != nil {
		return err
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gr.Close()

	return extractTarFromReader(store, ctx, gr, dest, jobID)
}

func extractTarFromReader(store *jobs.Store, ctx context.Context, reader io.Reader, dest, jobID string) error {
	tr := tar.NewReader(reader)
	var processedBytes int64
	var processedItems int64
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		cancelled, _ := store.IsCancelled(ctx, jobID)
		if cancelled {
			return nil
		}
		paused, _ := store.IsPaused(ctx, jobID)
		if paused {
			return errJobPaused
		}

		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		headerName := filepath.FromSlash(header.Name)
		filePath := filepath.Join(dest, headerName)
		if !strings.HasPrefix(filepath.Clean(filePath), filepath.Clean(dest)+string(filepath.Separator)) {
			continue
		}

		if header.Typeflag == tar.TypeDir {
			if err := os.MkdirAll(filePath, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
			return err
		}

		out, err := os.Create(filePath)
		if err != nil {
			return err
		}

		copied, err := io.Copy(out, tr)
		out.Close()
		if err != nil {
			return err
		}
		processedBytes += copied
		processedItems++
		_ = store.UpdateJobProgress(ctx, jobID, processedBytes, processedItems, header.Name)
	}
	return nil
}

func isTarArchive(name string) bool {
	return strings.HasSuffix(name, ".tar") ||
		strings.HasSuffix(name, ".tar.gz") ||
		strings.HasSuffix(name, ".tgz")
}

func ArchiveFormat(name string) string {
	lower := strings.ToLower(name)
	if strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz") {
		return "tar.gz"
	}
	if strings.HasSuffix(lower, ".tar") {
		return "tar"
	}
	if strings.HasSuffix(lower, ".zip") {
		return "zip"
	}
	return ""
}

func archiveBaseFromName(name string) string {
	lower := strings.ToLower(name)
	if strings.HasSuffix(lower, ".tar.gz") {
		return name[:len(name)-len(".tar.gz")]
	}
	if strings.HasSuffix(lower, ".tgz") {
		return name[:len(name)-len(".tgz")]
	}
	if strings.HasSuffix(lower, ".tar") {
		return name[:len(name)-len(".tar")]
	}
	if strings.HasSuffix(lower, ".zip") {
		return name[:len(name)-len(".zip")]
	}
	return name
}
