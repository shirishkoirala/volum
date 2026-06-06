package api

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	slashpath "path"
	"path/filepath"
	"strings"
)

const appBundleArchiveSuffix = ".app.zip"

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
	if err := os.RemoveAll(tempDir); err != nil {
		return finalizedAppBundle{}, true, err
	}
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		return finalizedAppBundle{}, true, err
	}

	if err := extractAppBundleArchive(archivePath, tempDir); err != nil {
		_ = os.RemoveAll(tempDir)
		return finalizedAppBundle{}, true, err
	}

	appPath, err := resolveUploadConflict(filepath.Join(parentDir, appName), conflictPolicy)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		return finalizedAppBundle{}, true, err
	}
	if err := os.Rename(tempDir, appPath); err != nil {
		_ = os.RemoveAll(tempDir)
		return finalizedAppBundle{}, true, err
	}
	if err := os.Remove(archivePath); err != nil {
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

func extractAppBundleArchive(archivePath, tempDir string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer reader.Close()

	root := appBundleArchiveRoot(reader.File)
	extracted := 0
	for _, file := range reader.File {
		rel, ok := appBundleArchiveRelPath(file.Name, root)
		if !ok {
			continue
		}
		target := filepath.Join(tempDir, filepath.FromSlash(rel))
		if !withinDirectory(tempDir, target) {
			continue
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		if err := writeZipFile(target, file); err != nil {
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

func writeZipFile(target string, file *zip.File) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	perm := file.Mode().Perm()
	if perm == 0 {
		perm = 0o644
	}
	dst, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(dst, src)
	closeErr := dst.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Chmod(target, perm)
}
