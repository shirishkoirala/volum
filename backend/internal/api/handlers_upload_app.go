package api

import (
	"archive/zip"
	"fmt"
	"io"
	slashpath "path"
	"path/filepath"
	"strings"

	"github.com/volum-app/volum/backend/internal/sysutil"
)

const appBundleArchiveSuffix = ".app.zip"

const (
	maxAppBundleBytes     = int64(10 * 1024 * 1024 * 1024)
	maxAppBundleFileBytes = int64(2 * 1024 * 1024 * 1024)
	maxAppBundleEntries   = 100_000
	minAppBundleFreeSpace = int64(64 * 1024 * 1024)
)

type finalizedAppBundle struct {
	path       string
	publicPath string
	filename   string
}

func (s *Server) finalizeAppBundleArchive(archivePath, archiveName, conflictPolicy string) (finalizedAppBundle, bool, error) {
	if archiveName == "" {
		archiveName = filepath.Base(archivePath)
	}
	if !strings.HasSuffix(strings.ToLower(archiveName), appBundleArchiveSuffix) {
		return finalizedAppBundle{}, false, nil
	}

	appName := archiveName[:len(archiveName)-len(".zip")]
	parentDir := filepath.Dir(archivePath)
	tempDir := filepath.Join(parentDir, ".volum-tmp", appName+".extracting")
	if err := s.guard.RemoveAll(tempDir); err != nil {
		return finalizedAppBundle{}, true, err
	}
	if err := s.guard.MkdirAll(tempDir, 0o755); err != nil {
		return finalizedAppBundle{}, true, err
	}

	if err := s.extractAppBundleArchive(archivePath, tempDir); err != nil {
		_ = s.guard.RemoveAll(tempDir)
		return finalizedAppBundle{}, true, err
	}

	appPath, err := s.resolveUploadConflict(filepath.Join(parentDir, appName), conflictPolicy)
	if err != nil {
		_ = s.guard.RemoveAll(tempDir)
		return finalizedAppBundle{}, true, err
	}
	if err := s.guard.RenameNoReplace(tempDir, appPath); err != nil {
		_ = s.guard.RemoveAll(tempDir)
		return finalizedAppBundle{}, true, err
	}
	if err := s.guard.Remove(archivePath); err != nil {
		return finalizedAppBundle{}, true, err
	}

	publicPath, err := s.guard.PublicPath(appPath)
	if err != nil {
		return finalizedAppBundle{}, true, err
	}
	return finalizedAppBundle{
		path:       appPath,
		publicPath: publicPath,
		filename:   filepath.Base(publicPath),
	}, true, nil
}

func (s *Server) extractAppBundleArchive(archivePath, tempDir string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer reader.Close()
	if len(reader.File) > maxAppBundleEntries {
		return fmt.Errorf("app bundle archive exceeds %d entries", maxAppBundleEntries)
	}
	var totalBytes int64
	for _, file := range reader.File {
		if file.UncompressedSize64 > uint64(maxAppBundleFileBytes) {
			return fmt.Errorf("app bundle entry %q exceeds %d bytes", file.Name, maxAppBundleFileBytes)
		}
		size := int64(file.UncompressedSize64)
		if totalBytes > maxAppBundleBytes-size {
			return fmt.Errorf("app bundle archive exceeds %d bytes", maxAppBundleBytes)
		}
		totalBytes += size
	}
	_, free, _, err := sysutil.DiskUsage(tempDir)
	if err != nil {
		return fmt.Errorf("check app bundle free space: %w", err)
	}
	if totalBytes > free-minAppBundleFreeSpace {
		return fmt.Errorf("app bundle requires %d bytes with %d bytes available", totalBytes, free)
	}

	root := appBundleArchiveRoot(reader.File)
	extracted := 0
	for _, file := range reader.File {
		if _, safe := cleanArchivePath(file.Name); !safe {
			return fmt.Errorf("app bundle archive contains unsafe path %q", file.Name)
		}
		rel, ok := appBundleArchiveRelPath(file.Name, root)
		if !ok {
			continue
		}
		target := filepath.Join(tempDir, filepath.FromSlash(rel))
		if !withinDirectory(tempDir, target) {
			continue
		}
		if file.FileInfo().IsDir() {
			if err := s.guard.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := s.guard.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		if err := s.writeZipFile(target, file); err != nil {
			return err
		}
		extracted++
	}
	if extracted == 0 {
		return fmt.Errorf("app bundle archive contains no files")
	}
	return nil
}

func appBundleArchiveRoot(files []*zip.File) string {
	var root string
	for _, file := range files {
		name, ok := cleanArchivePath(file.Name)
		if !ok {
			continue
		}
		part := strings.Split(name, "/")[0]
		if part == "__MACOSX" {
			continue
		}
		if root == "" {
			root = part
			continue
		}
		if root != part {
			return ""
		}
	}
	if strings.HasSuffix(strings.ToLower(root), ".app") {
		return root
	}
	return ""
}

func appBundleArchiveRelPath(name, root string) (string, bool) {
	clean, ok := cleanArchivePath(name)
	if !ok {
		return "", false
	}
	if root != "" {
		if clean == root {
			return "", false
		}
		prefix := root + "/"
		if !strings.HasPrefix(clean, prefix) {
			return "", false
		}
		clean = strings.TrimPrefix(clean, prefix)
	}
	if clean == "" || clean == "." || strings.Split(clean, "/")[0] == "__MACOSX" {
		return "", false
	}
	return clean, true
}

func cleanArchivePath(name string) (string, bool) {
	name = strings.TrimPrefix(strings.ReplaceAll(name, "\\", "/"), "/")
	clean := slashpath.Clean(name)
	if clean == "." || strings.HasPrefix(clean, "../") || strings.Contains(clean, "/../") {
		return "", false
	}
	return clean, true
}

func withinDirectory(root, target string) bool {
	root = filepath.Clean(root)
	target = filepath.Clean(target)
	return target == root || strings.HasPrefix(target, root+string(filepath.Separator))
}

func (s *Server) writeZipFile(target string, file *zip.File) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	perm := file.Mode().Perm()
	if perm == 0 {
		perm = 0o644
	}
	dst, err := s.guard.CreateFile(target, perm)
	if err != nil {
		return err
	}
	copied, copyErr := io.Copy(dst, io.LimitReader(src, maxAppBundleFileBytes+1))
	closeErr := dst.Close()
	if copyErr != nil {
		return copyErr
	}
	if copied > maxAppBundleFileBytes {
		return fmt.Errorf("app bundle entry %q exceeded %d bytes", file.Name, maxAppBundleFileBytes)
	}
	if closeErr != nil {
		return closeErr
	}
	return s.guard.Chmod(target, perm)
}
