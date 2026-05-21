package files

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/volum-app/volum/backend/internal/security"
)

type Entry struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Type        string    `json:"type"`
	Size        int64     `json:"size"`
	ModifiedAt  time.Time `json:"modifiedAt"`
	Permissions string    `json:"permissions"`
	Hidden      bool      `json:"hidden"`
}

var (
	ErrInvalidName       = errors.New("name cannot be empty or contain path separators")
	ErrDestinationExists = errors.New("destination already exists")
	ErrRootOperation     = errors.New("operation is not allowed on a configured root")
	ErrDirectoryDownload = errors.New("directories cannot be downloaded yet")
)

type Service struct {
	guard *security.RootGuard
}

func NewService(guard *security.RootGuard) *Service {
	return &Service{guard: guard}
}

func (s *Service) Roots() []string {
	return s.guard.Roots()
}

func (s *Service) List(path string, showHidden bool) ([]Entry, error) {
	resolved, err := s.guard.Resolve(path)
	if err != nil {
		return nil, err
	}

	items, err := os.ReadDir(resolved)
	if err != nil {
		return nil, err
	}

	entries := make([]Entry, 0, len(items))
	for _, item := range items {
		name := item.Name()
		hidden := strings.HasPrefix(name, ".")
		if hidden && !showHidden {
			continue
		}

		info, err := item.Info()
		if err != nil {
			continue
		}

		entryType := "file"
		if info.IsDir() {
			entryType = "directory"
		}

		entries = append(entries, Entry{
			Name:        name,
			Path:        filepath.Join(resolved, name),
			Type:        entryType,
			Size:        info.Size(),
			ModifiedAt:  info.ModTime(),
			Permissions: info.Mode().Perm().String(),
			Hidden:      hidden,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Type != entries[j].Type {
			return entries[i].Type == "directory"
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})

	return entries, nil
}

func (s *Service) CreateFolder(parentPath, name string) (Entry, error) {
	if !validBaseName(name) {
		return Entry{}, ErrInvalidName
	}

	parent, err := s.guard.Resolve(parentPath)
	if err != nil {
		return Entry{}, err
	}

	target, err := s.resolveChild(parent, name)
	if err != nil {
		return Entry{}, err
	}
	if _, err := os.Stat(target); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}

	if err := os.Mkdir(target, 0o755); err != nil {
		return Entry{}, err
	}
	return entryFromPath(target)
}

func (s *Service) Rename(path, newName string) (Entry, error) {
	if !validBaseName(newName) {
		return Entry{}, ErrInvalidName
	}

	source, err := s.guard.Resolve(path)
	if err != nil {
		return Entry{}, err
	}
	if s.isRoot(source) {
		return Entry{}, ErrRootOperation
	}

	target, err := s.resolveChild(filepath.Dir(source), newName)
	if err != nil {
		return Entry{}, err
	}
	if _, err := os.Stat(target); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}

	if err := os.Rename(source, target); err != nil {
		return Entry{}, err
	}
	return entryFromPath(target)
}

func (s *Service) Delete(path string) error {
	resolved, err := s.guard.Resolve(path)
	if err != nil {
		return err
	}
	if s.isRoot(resolved) {
		return ErrRootOperation
	}
	return os.RemoveAll(resolved)
}

func (s *Service) DownloadPath(path string) (string, os.FileInfo, error) {
	resolved, err := s.guard.Resolve(path)
	if err != nil {
		return "", nil, err
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return "", nil, err
	}
	if info.IsDir() {
		return "", nil, ErrDirectoryDownload
	}

	return resolved, info, nil
}

func (s *Service) resolveChild(parent, name string) (string, error) {
	return s.guard.Resolve(filepath.Join(parent, name))
}

func (s *Service) isRoot(path string) bool {
	for _, root := range s.guard.Roots() {
		if path == root {
			return true
		}
	}
	return false
}

func validBaseName(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && name == filepath.Base(name) && name != "." && name != ".."
}

func entryFromPath(path string) (Entry, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Entry{}, err
	}

	entryType := "file"
	if info.IsDir() {
		entryType = "directory"
	}

	return Entry{
		Name:        filepath.Base(path),
		Path:        path,
		Type:        entryType,
		Size:        info.Size(),
		ModifiedAt:  info.ModTime(),
		Permissions: info.Mode().Perm().String(),
		Hidden:      strings.HasPrefix(filepath.Base(path), "."),
	}, nil
}
