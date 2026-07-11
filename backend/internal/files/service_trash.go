package files

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/volum-app/volum/backend/internal/security"
)

func (s *Service) Trash(path string) (TrashEntry, error) {
	return s.TrashWithID(path, uuid.NewString())
}

// TrashWithID makes a trash move retryable by using the persistent job ID.
func (s *Service) TrashWithID(path, id string) (TrashEntry, error) {
	if !security.ValidBaseName(id) {
		return TrashEntry{}, ErrInvalidName
	}
	if entry, _, err := s.trashEntryByID(id); err == nil {
		if _, statErr := os.Stat(entry.TrashPath); statErr == nil {
			return entry, nil
		}
	}
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

	trashFiles := filepath.Join(trashRoot, "files")
	trashMeta := filepath.Join(trashRoot, "meta")
	if err := s.guard.MkdirAll(trashFiles, 0o755); err != nil {
		return TrashEntry{}, err
	}
	if err := s.guard.MkdirAll(trashMeta, 0o755); err != nil {
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
		DeletedAt:    now(),
		RootPath:     root.Path,
	}

	metaPath := filepath.Join(trashMeta, id+".json")
	if err := s.writeTrashEntry(metaPath, entry); err != nil {
		return TrashEntry{}, err
	}
	if err := s.moveAcrossFS(resolved, trashPath); err != nil {
		_ = s.guard.Remove(metaPath)
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
	return s.restoreTrash(id, false)
}

// RestoreTrashRetry resumes a worker-owned restore after an interrupted copy.
func (s *Service) RestoreTrashRetry(id string) (Entry, error) {
	return s.restoreTrash(id, true)
}

func (s *Service) restoreTrash(id string, retry bool) (Entry, error) {
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
		if !retry {
			return Entry{}, ErrDestinationExists
		}
		if _, trashErr := os.Stat(entry.TrashPath); errors.Is(trashErr, os.ErrNotExist) {
			if err := s.guard.Remove(metaPath); err != nil {
				return Entry{}, err
			}
			return s.entryFromPath(originalPath)
		}
		if err := s.guard.RemoveAll(originalPath); err != nil {
			return Entry{}, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}
	if err := s.guard.MkdirAll(filepath.Dir(originalPath), 0o755); err != nil {
		return Entry{}, err
	}
	if err := s.moveAcrossFS(entry.TrashPath, originalPath); err != nil {
		return Entry{}, err
	}
	if err := s.guard.Remove(metaPath); err != nil {
		return Entry{}, err
	}
	return s.entryFromPath(originalPath)
}

func (s *Service) DeleteTrash(id string) error {
	entry, metaPath, err := s.trashEntryByID(id)
	if err != nil {
		return err
	}
	if err := s.guard.RemoveAll(entry.TrashPath); err != nil {
		return err
	}
	return s.guard.Remove(metaPath)
}

func (s *Service) trashEntryByID(id string) (TrashEntry, string, error) {
	if !security.ValidBaseName(id) {
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

func (s *Service) writeTrashEntry(path string, entry TrashEntry) error {
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	file, err := s.guard.CreateFile(path, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.Write(data)
	return err
}

func (s *Service) moveAcrossFS(src, dst string) error {
	err := s.guard.RenameNoReplace(src, dst)
	if err == nil {
		return nil
	}
	if !errors.Is(err, syscall.EXDEV) {
		return err
	}
	if err := s.copyPath(src, dst); err != nil {
		return err
	}
	return s.guard.RemoveAll(src)
}

func (s *Service) copyFile(src, dst string) error {
	sf, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sf.Close()

	if err := s.guard.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	df, err := s.guard.CreateFile(dst, 0o644)
	if err != nil {
		return err
	}
	defer df.Close()

	if _, err := io.Copy(df, sf); err != nil {
		return err
	}
	return df.Sync()
}

func (s *Service) copyPath(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return s.copyFile(src, dst)
	}

	if err := s.guard.MkdirAll(dst, 0o755); err != nil {
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
			return s.guard.MkdirAll(target, 0o755)
		}
		return s.copyFile(path, target)
	})
}

func now() time.Time {
	return time.Now().UTC()
}
