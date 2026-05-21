package files

import (
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
