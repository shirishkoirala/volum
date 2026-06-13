package files

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
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
	Owner       string    `json:"owner"`
	Group       string    `json:"group"`
	Hidden      bool      `json:"hidden"`
}

type Root struct {
	Path       string `json:"path"`
	Label      string `json:"label,omitempty"`
	Source     string `json:"source,omitempty"`
	FSType     string `json:"fsType,omitempty"`
	Discovered bool   `json:"discovered"`
	Available  bool   `json:"available"`
	TotalBytes int64  `json:"totalBytes"`
	FreeBytes  int64  `json:"freeBytes"`
	UsedBytes  int64  `json:"usedBytes"`
	IsHome     bool   `json:"isHome"`
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
	Name       string `json:"name"`
	Path       string `json:"path"`
	Type       string `json:"type"`
	Size       int64  `json:"size"`
	ModifiedAt string `json:"modifiedAt"`
	Root       string `json:"root"`
	LineMatch  string `json:"lineMatch,omitempty"`
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
	cache *DirSizeCache
}

func NewService(guard *security.RootGuard, cache *DirSizeCache) *Service {
	return &Service{guard: guard, cache: cache}
}

func (s *Service) Cache() *DirSizeCache {
	return s.cache
}

func (s *Service) Roots() []string {
	return s.guard.Roots()
}

func (s *Service) RootUsage() []Root {
	roots := s.guard.RootEntries()
	usage := make([]Root, 0, len(roots))
	for _, root := range roots {
		item := Root{
			Path:       root.Path,
			Label:      root.Label,
			Source:     root.Source,
			FSType:     root.FSType,
			Discovered: root.Discovered,
			Available:  root.Available,
			IsHome:     root.IsHome,
		}
		if total, free, err := diskUsage(root.InternalPath); err == nil {
			item.TotalBytes = total
			item.FreeBytes = free
			item.UsedBytes = max(total-free, 0)
			item.Available = true
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

		itemPath := filepath.Join(resolved, name)
		publicPath, err := s.guard.PublicPath(itemPath)
		if err != nil {
			continue
		}

		var size int64
		if info.IsDir() {
			if cached, ok := s.cache.Get(publicPath); ok {
				size = cached
			} else {
				size = immediateDirSize(itemPath, info)
			}
		} else {
			size = info.Size()
		}

		entries = append(entries, Entry{
			Name:        name,
			Path:        publicPath,
			Type:        entryType,
			Size:        size,
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

func (s *Service) CreateFile(parentPath, name string) (Entry, error) {
	if !validBaseName(name) {
		return Entry{}, ErrInvalidName
	}

	parent, err := s.guard.Resolve(parentPath)
	if err != nil {
		return Entry{}, err
	}

	targetPublic := filepath.Join(filepath.Clean(parentPath), name)
	target, err := s.guard.Resolve(targetPublic)
	if err != nil {
		return Entry{}, err
	}
	if filepath.Dir(target) != parent {
		return Entry{}, security.ErrPathTraversal
	}
	if _, err := os.Stat(target); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}

	f, err := os.Create(target)
	if err != nil {
		return Entry{}, err
	}
	f.Close()
	return s.entryFromPath(target)
}

func (s *Service) CreateFolder(parentPath, name string) (Entry, error) {
	if !validBaseName(name) {
		return Entry{}, ErrInvalidName
	}

	parent, err := s.guard.Resolve(parentPath)
	if err != nil {
		return Entry{}, err
	}

	targetPublic := filepath.Join(filepath.Clean(parentPath), name)
	target, err := s.guard.Resolve(targetPublic)
	if err != nil {
		return Entry{}, err
	}
	if filepath.Dir(target) != parent {
		return Entry{}, security.ErrPathTraversal
	}
	if _, err := os.Stat(target); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}

	if err := os.Mkdir(target, 0o755); err != nil {
		return Entry{}, err
	}
	return s.entryFromPath(target)
}

func (s *Service) Rename(path, newName string) (Entry, error) {
	if !validBaseName(newName) {
		return Entry{}, ErrInvalidName
	}

	source, err := s.guard.Resolve(path)
	if err != nil {
		return Entry{}, err
	}
	if s.guard.IsRoot(source) {
		return Entry{}, ErrRootOperation
	}

	targetPublic := filepath.Join(filepath.Dir(filepath.Clean(path)), newName)
	target, err := s.guard.Resolve(targetPublic)
	if err != nil {
		return Entry{}, err
	}
	if filepath.Dir(target) != filepath.Dir(source) {
		return Entry{}, security.ErrPathTraversal
	}
	if _, err := os.Stat(target); err == nil {
		return Entry{}, ErrDestinationExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return Entry{}, err
	}

	if err := os.Rename(source, target); err != nil {
		return Entry{}, err
	}
	return s.entryFromPath(target)
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
	if s.guard.IsRoot(resolved) {
		return Entry{}, ErrRootOperation
	}

	parsed, err := parseMode(mode)
	if err != nil {
		return Entry{}, err
	}
	if err := os.Chmod(resolved, parsed); err != nil {
		return Entry{}, err
	}
	return s.entryFromPath(resolved)
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

func (s *Service) entryFromPath(path string) (Entry, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Entry{}, err
	}
	publicPath, err := s.guard.PublicPath(path)
	if err != nil {
		return Entry{}, err
	}

	entryType := "file"
	if info.IsDir() {
		entryType = "directory"
	}

	return Entry{
		Name:        filepath.Base(path),
		Path:        publicPath,
		Type:        entryType,
		Size:        immediateDirSize(path, info),
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

func immediateDirSize(path string, info os.FileInfo) int64 {
	if !info.IsDir() {
		return info.Size()
	}
	items, err := os.ReadDir(path)
	if err != nil {
		return 0
	}
	var total int64
	for _, item := range items {
		itemInfo, err := item.Info()
		if err != nil {
			continue
		}
		if !itemInfo.IsDir() {
			total += itemInfo.Size()
		}
	}
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
	roots := s.guard.RootEntries()

	for _, root := range roots {
		err := filepath.WalkDir(root.InternalPath, func(path string, entry os.DirEntry, walkErr error) error {
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
				publicPath, err := s.guard.PublicPath(path)
				if err != nil {
					return nil
				}
				results = append(results, SearchResult{
					Name:       name,
					Path:       publicPath,
					Type:       entryType,
					Size:       info.Size(),
					ModifiedAt: info.ModTime().UTC().Format(time.RFC3339),
					Root:       root.Path,
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

func validBaseName(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && name == filepath.Base(name) && name != "." && name != ".."
}

func isPathInside(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
