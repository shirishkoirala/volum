package worker

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/volum-app/volum/backend/internal/jobs"
)

func writeTar(store *jobs.Store, ctx context.Context, writer io.Writer, jobID, source string) error {
	tw := tar.NewWriter(writer)
	defer tw.Close()

	return walkWithJobControl(store, ctx, jobID, source, func(path, rel string, entry os.DirEntry) error {
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
	var totalBytes int64
	var totalItems int64
	var processedBytes int64
	var processedItems int64

	// First pass: count totals (tar requires reading to know sizes).
	// We use a temporary reader to count without consuming the main one,
	// but tar format doesn't support seeking, so we enforce limits inline.

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

		totalItems++
		if totalItems > maxExtractEntries {
			return fmt.Errorf("%w: exceeded %d entries", errExtractLimit, maxExtractEntries)
		}

		parts := strings.Split(filepath.ToSlash(header.Name), "/")
		if len(parts) > maxExtractPathDepth {
			return fmt.Errorf("archive entry %s exceeds maximum path depth of %d", header.Name, maxExtractPathDepth)
		}

		if header.Typeflag == tar.TypeDir {
			if err := ensureExtractDir(dest, header.Name); err != nil {
				return err
			}
			continue
		}

		if header.Typeflag != tar.TypeReg {
			continue
		}

		if header.Size < 0 || header.Size > maxExtractPerFile {
			return fmt.Errorf("archive entry %s exceeds per-file limit of %d bytes", header.Name, maxExtractPerFile)
		}

		totalBytes += header.Size
		if totalBytes > maxExtractTotalBytes {
			return fmt.Errorf("%w: exceeded %d total bytes", errExtractLimit, maxExtractTotalBytes)
		}
		if err := ensureExtractSpace(dest, header.Size); err != nil {
			return err
		}

		_ = store.SetJobTotals(ctx, jobID, totalBytes, totalItems)

		out, err := openExtractFile(dest, header.Name)
		if err != nil {
			return err
		}

		copied, err := io.CopyN(out, tr, header.Size)
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
