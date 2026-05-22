package files

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/volum-app/volum/backend/internal/security"
)

type Entry struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Type        string    `json:"type"`
	Size        int64     `json:"size"`
	ModifiedAt  time.Time `json:"modifiedAt"`
	Permissions string    `json:"permissions"`
	Owner       string    `json:"owner"`
	Group       string    `json:"group"`
	Hidden      bool      `json:"hidden"`
}

type Root struct {
	Path       string `json:"path"`
	TotalBytes int64  `json:"totalBytes"`
	FreeBytes  int64  `json:"freeBytes"`
	UsedBytes  int64  `json:"usedBytes"`
}

type TrashEntry struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	OriginalPath string    `json:"originalPath"`
	TrashPath    string    `json:"trashPath"`
	Type         string    `json:"type"`
	Size         int64     `json:"size"`
	DeletedAt    time.Time `json:"deletedAt"`
	RootPath     string    `json:"rootPath"`
}

type SearchResult struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"`
	Size        int64  `json:"size"`
	ModifiedAt  string `json:"modifiedAt"`
	Root        string `json:"root"`
	LineMatch   string `json:"lineMatch,omitempty"`
}

var (
	ErrInvalidName       = errors.New("name cannot be empty or contain path separators")
	ErrDestinationExists = errors.New("destination already exists")
	ErrRootOperation     = errors.New("operation is not allowed on a configured root")
	ErrDirectoryDownload = errors.New("directories cannot be downloaded yet")
	ErrTrashOperation    = errors.New("items in trash must be restored or permanently deleted")
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

func (s *Service) RootUsage() []Root {
	roots := s.guard.Roots()
	usage := make([]Root, 0, len(roots))
	for _, root := range roots {
		item := Root{Path: root}
		if total, free, err := diskUsage(root); err == nil {
			item.TotalBytes = total
			item.FreeBytes = free
			item.UsedBytes = max(total-free, 0)
		}
		usage = append(usage, item)
	}
	return usage
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
			Size:        entrySize(filepath.Join(resolved, name), info),
			ModifiedAt:  info.ModTime(),
			Permissions: info.Mode().Perm().String(),
			Owner:       ownerName(info),
			Group:       groupName(info),
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
	_, err := s.Trash(path)
	return err
}

func (s *Service) Chmod(path, mode string) (Entry, error) {
	resolved, err := s.guard.Resolve(path)
	if err != nil {
		return Entry{}, err
	}
	if s.isRoot(resolved) {
		return Entry{}, ErrRootOperation
	}

	parsed, err := parseMode(mode)
	if err != nil {
		return Entry{}, err
	}
	if err := os.Chmod(resolved, parsed); err != nil {
		return Entry{}, err
	}
	return entryFromPath(resolved)
}

func parseMode(mode string) (os.FileMode, error) {
	if len(mode) == 9 {
		var modeBits os.FileMode
		for _, ch := range mode {
			modeBits <<= 1
			if ch != '-' {
				modeBits |= 1
			}
		}
		return modeBits, nil
	}
	if len(mode) == 3 || len(mode) == 4 {
		var modeBits os.FileMode
		for _, ch := range mode {
			if ch < '0' || ch > '7' {
				return 0, fmt.Errorf("invalid octal mode: %s", mode)
			}
			modeBits = modeBits<<3 | os.FileMode(ch-'0')
		}
		return modeBits, nil
	}
	return 0, fmt.Errorf("mode must be a 9-character permission string (e.g. rwxr-xr-x) or 3-4 digit octal")
}

func (s *Service) Trash(path string) (TrashEntry, error) {
	resolved, err := s.guard.Resolve(path)
	if err != nil {
		return TrashEntry{}, err
	}
	if s.isRoot(resolved) {
		return TrashEntry{}, ErrRootOperation
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return TrashEntry{}, err
	}

	root, ok := s.rootFor(resolved)
	if !ok {
		return TrashEntry{}, security.ErrOutsideRoots
	}
	trashRoot := filepath.Join(root, ".volum-trash")
	if isPathInside(trashRoot, resolved) {
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
		OriginalPath: resolved,
		TrashPath:    trashPath,
		Type:         entryType,
		Size:         entrySize(resolved, info),
		DeletedAt:    time.Now().UTC(),
		RootPath:     root,
	}

	if err := os.Rename(resolved, trashPath); err != nil {
		return TrashEntry{}, err
	}
	if err := writeTrashEntry(filepath.Join(trashMeta, id+".json"), entry); err != nil {
		_ = os.Rename(trashPath, resolved)
		return TrashEntry{}, err
	}
	return entry, nil
}

func (s *Service) ListTrash() ([]TrashEntry, error) {
	entries := []TrashEntry{}
	for _, root := range s.guard.Roots() {
		metaDir := filepath.Join(root, ".volum-trash", "meta")
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
	if _, ok := s.rootFor(entry.OriginalPath); !ok {
		return Entry{}, security.ErrOutsideRoots
	}
	if _, err := os.Stat(entry.OriginalPath); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}
	if err := os.MkdirAll(filepath.Dir(entry.OriginalPath), 0o755); err != nil {
		return Entry{}, err
	}
	if err := os.Rename(entry.TrashPath, entry.OriginalPath); err != nil {
		return Entry{}, err
	}
	if err := os.Remove(metaPath); err != nil {
		return Entry{}, err
	}
	return entryFromPath(entry.OriginalPath)
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

func (s *Service) ThumbnailPath(path string) (string, os.FileInfo, error) {
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

func (s *Service) rootFor(path string) (string, bool) {
	for _, root := range s.guard.Roots() {
		if isPathInside(root, path) {
			return root, true
		}
	}
	return "", false
}

func (s *Service) trashEntryByID(id string) (TrashEntry, string, error) {
	if !validBaseName(id) {
		return TrashEntry{}, "", ErrInvalidName
	}
	for _, root := range s.guard.Roots() {
		metaPath := filepath.Join(root, ".volum-trash", "meta", id+".json")
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

func validBaseName(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && name == filepath.Base(name) && name != "." && name != ".."
}

func isPathInside(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
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
		Size:        entrySize(path, info),
		ModifiedAt:  info.ModTime(),
		Permissions: info.Mode().Perm().String(),
		Owner:       ownerName(info),
		Group:       groupName(info),
		Hidden:      strings.HasPrefix(filepath.Base(path), "."),
	}, nil
}

func ownerName(info os.FileInfo) string {
	if stat, ok := info.Sys().(*syscall.Stat_t); ok {
		return fmt.Sprintf("%d", stat.Uid)
	}
	return ""
}

func groupName(info os.FileInfo) string {
	if stat, ok := info.Sys().(*syscall.Stat_t); ok {
		return fmt.Sprintf("%d", stat.Gid)
	}
	return ""
}

func entrySize(path string, info os.FileInfo) int64 {
	if !info.IsDir() {
		return info.Size()
	}

	var total int64
	_ = filepath.WalkDir(path, func(current string, entry os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		itemInfo, err := entry.Info()
		if err != nil {
			return nil
		}
		total += itemInfo.Size()
		return nil
	})
	return total
}

func diskUsage(path string) (int64, int64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0, err
	}
	blockSize := uint64(stat.Bsize)
	total := stat.Blocks * blockSize
	free := stat.Bavail * blockSize
	return int64(min(total, uint64(^uint64(0)>>1))), int64(min(free, uint64(^uint64(0)>>1))), nil
}

func (s *Service) Search(query string, maxResults int) ([]SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return nil, errors.New("search query is required")
	}
	if maxResults <= 0 || maxResults > 200 {
		maxResults = 50
	}

	lower := strings.ToLower(query)
	results := make([]SearchResult, 0)
	roots := s.guard.Roots()

	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return nil
			}
			name := entry.Name()
			if strings.HasPrefix(name, ".") || strings.HasPrefix(name, ".volum-trash") || strings.HasPrefix(filepath.Base(filepath.Dir(path)), ".volum-tmp") {
				if entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if !entry.IsDir() && !isTextFile(name) {
				return nil
			}
			if strings.Contains(strings.ToLower(name), lower) || (entry.IsDir() && strings.Contains(strings.ToLower(filepath.Base(path)), lower)) {
				info, err := entry.Info()
				if err != nil {
					return nil
				}
				entryType := "file"
				if entry.IsDir() {
					entryType = "directory"
				}
				results = append(results, SearchResult{
					Name:       name,
					Path:       path,
					Type:       entryType,
					Size:       info.Size(),
					ModifiedAt: info.ModTime().UTC().Format(time.RFC3339),
					Root:       root,
				})
				if len(results) >= maxResults {
					return errSearchComplete
				}
			}
			return nil
		})
		if errors.Is(err, errSearchComplete) {
			break
		}
	}
	return results, nil
}

var errSearchComplete = errors.New("search complete")

var textExtensions = map[string]bool{
	".cfg": true, ".conf": true, ".csv": true, ".css": true, ".env": true,
	".go": true, ".html": true, ".htm": true, ".ini": true, ".java": true,
	".js": true, ".jsx": true, ".json": true, ".log": true, ".md": true,
	".php": true, ".properties": true, ".py": true, ".rb": true, ".rst": true,
	".sh": true, ".sql": true, ".svg": true, ".toml": true, ".ts": true,
	".tsx": true, ".txt": true, ".xml": true, ".yaml": true, ".yml": true,
}

func isTextFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return textExtensions[ext]
}
