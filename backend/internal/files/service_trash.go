package files

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/volum-app/volum/backend/internal/security"
)

func (s *Service) Trash(path string) (TrashEntry, error) {
	resolved, err := s.guard.Resolve(path)
	if err != nil {
		return TrashEntry{}, err
	}
	if s.guard.IsRoot(resolved) {
		return TrashEntry{}, ErrRootOperation
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return TrashEntry{}, err
	}

	root, ok := s.guard.RootFor(resolved)
	if !ok {
		return TrashEntry{}, security.ErrOutsideRoots
	}
	trashRoot := filepath.Join(root.InternalPath, ".volum-trash")
	if security.PathInside(trashRoot, resolved) {
		return TrashEntry{}, ErrTrashOperation
	}

	id := uuid.NewString()
	trashFiles := filepath.Join(trashRoot, "files")
	trashMeta := filepath.Join(trashRoot, "meta")
	if err := os.MkdirAll(trashFiles, 0o755); err != nil {
		return TrashEntry{}, err
	}
	if err := os.MkdirAll(trashMeta, 0o755); err != nil {
		return TrashEntry{}, err
	}

	trashPath := filepath.Join(trashFiles, id+"-"+filepath.Base(resolved))
	entryType := "file"
	if info.IsDir() {
		entryType = "directory"
	}
	entry := TrashEntry{
		ID:           id,
		Name:         filepath.Base(resolved),
		OriginalPath: path,
		TrashPath:    trashPath,
		Type:         entryType,
		Size:         immediateDirSize(resolved, info),
		DeletedAt:    time.Now().UTC(),
		RootPath:     root.Path,
	}

	if err := moveAcrossFS(resolved, trashPath); err != nil {
		return TrashEntry{}, err
	}
	if err := writeTrashEntry(filepath.Join(trashMeta, id+".json"), entry); err != nil {
		_ = moveAcrossFS(trashPath, resolved)
		return TrashEntry{}, err
	}
	return entry, nil
}

func (s *Service) ListTrash() ([]TrashEntry, error) {
	entries := []TrashEntry{}
	for _, root := range s.guard.RootEntries() {
		metaDir := filepath.Join(root.InternalPath, ".volum-trash", "meta")
		items, err := os.ReadDir(metaDir)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		for _, item := range items {
			if item.IsDir() || filepath.Ext(item.Name()) != ".json" {
				continue
			}
			entry, err := readTrashEntry(filepath.Join(metaDir, item.Name()))
			if err != nil {
				continue
			}
			if _, err := os.Stat(entry.TrashPath); err != nil {
				continue
			}
			entries = append(entries, entry)
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].DeletedAt.After(entries[j].DeletedAt)
	})
	return entries, nil
}

func (s *Service) RestoreTrash(id string) (Entry, error) {
	entry, metaPath, err := s.trashEntryByID(id)
	if err != nil {
		return Entry{}, err
	}
	originalPath, err := s.guard.Resolve(entry.OriginalPath)
	if err != nil {
		return Entry{}, err
	}
	if _, ok := s.guard.RootFor(originalPath); !ok {
		return Entry{}, security.ErrOutsideRoots
	}
	if _, err := os.Stat(originalPath); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}
	if err := os.MkdirAll(filepath.Dir(originalPath), 0o755); err != nil {
		return Entry{}, err
	}
	if err := moveAcrossFS(entry.TrashPath, originalPath); err != nil {
		return Entry{}, err
	}
	if err := os.Remove(metaPath); err != nil {
		return Entry{}, err
	}
	return s.entryFromPath(originalPath)
}

func (s *Service) DeleteTrash(id string) error {
	entry, metaPath, err := s.trashEntryByID(id)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(entry.TrashPath); err != nil {
		return err
	}
	return os.Remove(metaPath)
}

func (s *Service) trashEntryByID(id string) (TrashEntry, string, error) {
	if !validBaseName(id) {
		return TrashEntry{}, "", ErrInvalidName
	}
	for _, root := range s.guard.RootEntries() {
		metaPath := filepath.Join(root.InternalPath, ".volum-trash", "meta", id+".json")
		entry, err := readTrashEntry(metaPath)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return TrashEntry{}, "", err
		}
		return entry, metaPath, nil
	}
	return TrashEntry{}, "", os.ErrNotExist
}

func readTrashEntry(path string) (TrashEntry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return TrashEntry{}, err
	}
	var entry TrashEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return TrashEntry{}, err
	}
	if entry.ID == "" || entry.OriginalPath == "" || entry.TrashPath == "" {
		return TrashEntry{}, fmt.Errorf("invalid trash metadata %s", path)
	}
	return entry, nil
}

func writeTrashEntry(path string, entry TrashEntry) error {
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func moveAcrossFS(src, dst string) error {
	err := os.Rename(src, dst)
	if err == nil {
		return nil
	}
	var linkErr *os.LinkError
	if !errors.As(err, &linkErr) {
		return err
	}
	if err := copyPath(src, dst); err != nil {
		return err
	}
	return os.RemoveAll(src)
}

func copyFile(src, dst string) error {
	sf, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sf.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	df, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer df.Close()

	if _, err := io.Copy(df, sf); err != nil {
		return err
	}
	return df.Sync()
}

func copyPath(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return copyFile(src, dst)
	}

	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	return filepath.WalkDir(src, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFile(path, target)
	})
}
