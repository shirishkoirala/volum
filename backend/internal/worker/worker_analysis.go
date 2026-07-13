package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/volum-app/volum/backend/internal/jobs"
)

type dirAccum struct {
	publicPath string
	parentPath string
	name       string
	sizeBytes  int64
	fileCount  int64
	dirCount   int64
}

func (w *Worker) processDiskAnalyze(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil {
		return fmt.Errorf("disk_analyze job requires a source path")
	}
	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return err
	}

	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("disk_analyze source must be a directory")
	}

	if job.Status == jobs.StatusQueued {
		if err := w.store.StartJob(ctx, job.ID); err != nil {
			return err
		}
	}

	accum := make(map[string]*dirAccum) // keyed by internal path
	var skipped int64
	var totalFiles, totalDirs int64
	lastUpdate := time.Now()

	// Phase 1: walk and accumulate file sizes per directory
	walkErr := filepath.WalkDir(source, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			skipped++
			return nil //nolint:nilerr // unreadable paths are counted and skipped
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Check pause/cancel periodically
		if time.Since(lastUpdate) > 500*time.Millisecond {
			stopped, err := w.checkStopped(ctx, job.ID)
			if err != nil {
				return err
			}
			if stopped {
				return errJobPaused
			}
			lastUpdate = time.Now()
		}

		name := d.Name()
		if strings.HasPrefix(name, ".") || name == ".volum-trash" || name == ".volum-tmp" {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Never follow symlinks
		info := resolveDirEntry(d)
		if info == nil {
			skipped++
			return nil
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return nil
		}

		rel, _ := filepath.Rel(source, path)
		publicPath := filepath.ToSlash(filepath.Join(*job.SourcePath, rel))
		parentPublic := ""
		if path != source {
			parentRel, _ := filepath.Rel(source, filepath.Dir(path))
			parentPublic = *job.SourcePath
			if parentRel != "." {
				parentPublic = filepath.ToSlash(filepath.Join(*job.SourcePath, parentRel))
			}
		}

		if d.IsDir() {
			accum[path] = &dirAccum{
				publicPath: publicPath,
				parentPath: parentPublic,
				name:       name,
			}
			totalDirs++
		} else {
			parent := filepath.Dir(path)
			pa, ok := accum[parent]
			if !ok {
				skipped++
				return nil
			}
			pa.sizeBytes += info.Size()
			pa.fileCount++
			totalFiles++
		}

		_ = w.store.UpdateJobProgress(ctx, job.ID, 0, totalFiles+totalDirs, name)
		return nil
	})
	if errors.Is(walkErr, errJobPaused) {
		return nil
	}
	if walkErr != nil {
		return walkErr
	}

	// Phase 2: accumulate bottom-up (directories sorted by depth descending)
	type kv struct {
		path  string
		accum *dirAccum
	}
	var sorted []kv
	for p, a := range accum {
		sorted = append(sorted, kv{p, a})
	}
	// Sort by depth descending so children are processed before parents
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if depth(sorted[i].path) < depth(sorted[j].path) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	for _, kv := range sorted {
		parent := filepath.Dir(kv.path)
		if pa, ok := accum[parent]; ok {
			pa.sizeBytes += kv.accum.sizeBytes
			pa.fileCount += kv.accum.fileCount
			pa.dirCount += kv.accum.dirCount + 1
		}
	}

	// Phase 3: write results
	var results []jobs.DiskUsageResult
	for _, kv := range sorted {
		results = append(results, jobs.DiskUsageResult{
			JobID:      job.ID,
			Path:       kv.accum.publicPath,
			ParentPath: kv.accum.parentPath,
			Name:       kv.accum.name,
			IsDir:      true,
			SizeBytes:  kv.accum.sizeBytes,
			FileCount:  kv.accum.fileCount,
			DirCount:   kv.accum.dirCount,
		})
	}

	if err := w.store.ClearDiskUsageResults(ctx, job.ID); err != nil {
		return err
	}
	if err := w.store.InsertDiskUsageResults(ctx, results); err != nil {
		return err
	}
	_ = w.store.SetJobTotals(ctx, job.ID, int64(len(results)), totalFiles+totalDirs)

	return w.store.CompleteJob(ctx, job.ID)
}

type fileCandidate struct {
	path       string
	publicPath string
	size       int64
	modified   string
	dev        uint64
	inode      uint64
}

func (w *Worker) processDuplicateFind(ctx context.Context, job jobs.Job) error {
	if job.SourcePath == nil {
		return fmt.Errorf("duplicate_find job requires a source path")
	}
	source, err := w.guard.Resolve(*job.SourcePath)
	if err != nil {
		return err
	}

	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("duplicate_find source must be a directory")
	}

	if job.Status == jobs.StatusQueued {
		if err := w.store.StartJob(ctx, job.ID); err != nil {
			return err
		}
	}

	// Phase 1: walk and collect all files
	var allFiles []fileCandidate
	var skipped int64
	lastUpdate := time.Now()

	walkErr := filepath.WalkDir(source, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			skipped++
			return nil //nolint:nilerr // unreadable paths are counted and skipped
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if time.Since(lastUpdate) > 500*time.Millisecond {
			stopped, err := w.checkStopped(ctx, job.ID)
			if err != nil {
				return err
			}
			if stopped {
				return errJobPaused
			}
			lastUpdate = time.Now()
		}

		name := d.Name()
		if strings.HasPrefix(name, ".") || name == ".volum-trash" || name == ".volum-tmp" {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if d.IsDir() {
			return nil
		}

		finfo := resolveDirEntry(d)
		if finfo == nil {
			skipped++
			return nil
		}
		if finfo.Mode()&os.ModeSymlink != 0 {
			return nil
		}
		if !finfo.Mode().IsRegular() {
			return nil
		}
		if finfo.Size() == 0 {
			return nil
		}

		rel, _ := filepath.Rel(source, path)
		publicPath := filepath.ToSlash(filepath.Join(*job.SourcePath, rel))
		stat, _ := finfo.Sys().(*syscall.Stat_t)
		var dev, ino uint64
		if stat != nil {
			dev = uint64(stat.Dev) //nolint:unconvert // darwin=int32, linux=uint64
			ino = uint64(stat.Ino) //nolint:unconvert
		}

		modified := finfo.ModTime().UTC().Format(time.RFC3339)
		allFiles = append(allFiles, fileCandidate{
			path:       path,
			publicPath: publicPath,
			size:       finfo.Size(),
			modified:   modified,
			dev:        dev,
			inode:      ino,
		})
		_ = w.store.UpdateJobProgress(ctx, job.ID, 0, int64(len(allFiles)), name)
		return nil
	})
	if errors.Is(walkErr, errJobPaused) {
		return nil
	}
	if walkErr != nil {
		return walkErr
	}

	if len(allFiles) == 0 {
		return w.store.CompleteJob(ctx, job.ID)
	}

	// Phase 2: group by size
	sizeGroups := make(map[int64][]fileCandidate)
	for _, f := range allFiles {
		sizeGroups[f.size] = append(sizeGroups[f.size], f)
	}

	// Phase 3: group by size, hash prefix, then full SHA-256
	const prefixBytes = 64 * 1024
	var groupID int
	var results []jobs.DuplicateResult

	for _, candidates := range sizeGroups {
		if len(candidates) < 2 {
			continue
		}

		// Deduplicate hard links
		inodes := make(map[string]bool)
		var unique []fileCandidate
		for _, f := range candidates {
			key := fmt.Sprintf("%d:%d", f.dev, f.inode)
			if inodes[key] {
				continue
			}
			inodes[key] = true
			unique = append(unique, f)
		}
		if len(unique) < 2 {
			continue
		}

		// Check file stability before full hashing
		var stable []fileCandidate
		for _, f := range unique {
			if stableFile(f.path, f.size, f.modified) {
				stable = append(stable, f)
			}
		}
		if len(stable) < 2 {
			continue
		}

		// Hash 64KB prefix to filter obviously different files
		prefixGroups := make(map[string][]fileCandidate)
		for _, f := range stable {
			h := sha256.New()
			fh, err := os.Open(f.path)
			if err != nil {
				skipped++
				continue
			}
			_, err = io.CopyN(h, fh, prefixBytes)
			fh.Close()
			if err != nil && err != io.EOF {
				skipped++
				continue
			}
			key := hex.EncodeToString(h.Sum(nil))
			prefixGroups[key] = append(prefixGroups[key], f)
		}

		for _, pg := range prefixGroups {
			if len(pg) < 2 {
				continue
			}
			// Full SHA-256 for prefix-matched candidates
			fullGroups := make(map[string][]fileCandidate)
			for _, f := range pg {
				hash, err := fileSHA256Simple(f.path)
				if err != nil {
					skipped++
					continue
				}
				fullGroups[hash] = append(fullGroups[hash], f)
			}
			for hash, fg := range fullGroups {
				if len(fg) < 2 {
					continue
				}
				groupID++
				for _, f := range fg {
					mod := f.modified
					results = append(results, jobs.DuplicateResult{
						JobID:      job.ID,
						GroupID:    groupID,
						Path:       f.publicPath,
						SizeBytes:  f.size,
						Checksum:   hash,
						ModifiedAt: &mod,
					})
				}
			}
		}
	}

	if len(results) > 0 {
		if err := w.store.ClearDuplicateResults(ctx, job.ID); err != nil {
			return err
		}
		if err := w.store.InsertDuplicateResults(ctx, results); err != nil {
			return err
		}
	}
	_ = w.store.SetJobTotals(ctx, job.ID, 0, int64(len(results)))

	return w.store.CompleteJob(ctx, job.ID)
}

func stableFile(path string, origSize int64, origMod string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	if info.Size() != origSize {
		return false
	}
	return info.ModTime().UTC().Format(time.RFC3339) == origMod
}

func fileSHA256Simple(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func depth(path string) int {
	return strings.Count(path, string(filepath.Separator))
}

func resolveDirEntry(d os.DirEntry) os.FileInfo {
	info, err := d.Info()
	if err != nil {
		return nil
	}
	return info
}

func (w *Worker) checkStopped(ctx context.Context, jobID string) (bool, error) {
	status, err := w.store.GetJobStatus(ctx, jobID)
	if err != nil {
		return false, err
	}
	if status == jobs.StatusPaused || status == jobs.StatusCancelled {
		return true, nil
	}
	return false, nil
}
