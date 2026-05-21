package worker

import (
	"archive/zip"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func writeZip(store *jobs.Store, ctx context.Context, writer io.Writer, jobID, source string) error {
	zw := zip.NewWriter(writer)
	defer zw.Close()

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

		zipRel := filepath.ToSlash(rel)
		info, err := entry.Info()
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = zipRel
		header.Method = zip.Deflate
		if entry.IsDir() {
			header.Name += "/"
			_, err := zw.CreateHeader(header)
			return err
		}

		w, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		copied, err := io.Copy(w, f)
		if err != nil {
			return err
		}
		_ = store.UpdateJobProgress(ctx, jobID, copied, 0, path)
		return nil
	})
}

func extractZip(store *jobs.Store, ctx context.Context, dest, jobID, source string) error {
	f, err := os.Open(source)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}

	reader, err := zip.NewReader(f, info.Size())
	if err != nil {
		return err
	}

	var totalBytes int64
	for _, file := range reader.File {
		totalBytes += int64(file.UncompressedSize64)
	}
	_ = store.SetJobTotals(ctx, jobID, totalBytes, int64(len(reader.File)))

	var processedBytes int64
	var processedItems int64
	for _, file := range reader.File {
		cancelled, _ := store.IsCancelled(ctx, jobID)
		if cancelled {
			return nil
		}
		paused, _ := store.IsPaused(ctx, jobID)
		if paused {
			return errJobPaused
		}

		filePath := filepath.Join(dest, filepath.FromSlash(file.Name))
		if !strings.HasPrefix(filepath.Clean(filePath), filepath.Clean(dest)+string(filepath.Separator)) && filepath.Clean(filePath) != filepath.Clean(dest) {
			continue
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(filePath, 0o755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
			return err
		}

		src, err := file.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(filePath)
		if err != nil {
			src.Close()
			return err
		}
		copied, err := io.Copy(out, src)
		src.Close()
		out.Close()
		if err != nil {
			return err
		}
		processedBytes += copied
		processedItems++
		_ = store.UpdateJobProgress(ctx, jobID, processedBytes, processedItems, file.Name)
	}
	return nil
}
