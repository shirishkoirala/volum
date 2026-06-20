package worker

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func writeZip(store *jobs.Store, ctx context.Context, writer io.Writer, jobID, source string) error {
	zw := zip.NewWriter(writer)
	defer zw.Close()

	return walkWithJobControl(store, ctx, jobID, source, func(path, rel string, entry os.DirEntry) error {
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
	if totalBytes > maxExtractTotalBytes {
		return fmt.Errorf("%w: declared %d bytes", errExtractLimit, totalBytes)
	}
	if len(reader.File) > maxExtractEntries {
		return fmt.Errorf("%w: declared %d entries", errExtractLimit, len(reader.File))
	}
	_ = store.SetJobTotals(ctx, jobID, totalBytes, int64(len(reader.File)))

	var processedBytes int64
	var processedItems int64
	for _, file := range reader.File {
		if file.UncompressedSize64 > maxExtractPerFile {
			return fmt.Errorf("archive entry %s exceeds per-file limit of %d bytes", file.Name, maxExtractPerFile)
		}
		parts := strings.Split(filepath.ToSlash(file.Name), "/")
		if len(parts) > maxExtractPathDepth {
			return fmt.Errorf("archive entry %s exceeds maximum path depth of %d", file.Name, maxExtractPathDepth)
		}
		cancelled, _ := store.IsCancelled(ctx, jobID)
		if cancelled {
			return nil
		}
		paused, _ := store.IsPaused(ctx, jobID)
		if paused {
			return errJobPaused
		}

		if file.FileInfo().IsDir() {
			if err := ensureExtractDir(dest, file.Name); err != nil {
				return err
			}
			continue
		}

		// Reject symlinks, hardlinks, devices, FIFOs, and other non-regular files.
		mode := file.FileInfo().Mode()
		if !mode.IsRegular() {
			continue
		}

		src, err := file.Open()
		if err != nil {
			return err
		}
		out, err := openExtractFile(dest, file.Name)
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
