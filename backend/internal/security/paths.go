package security

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var (
	ErrEmptyPath     = errors.New("path is required")
	ErrPathTraversal = errors.New("path traversal is not allowed")
	ErrOutsideRoots  = errors.New("path is outside configured roots")
)

type Root struct {
	Path         string `json:"path"`
	InternalPath string `json:"-"`
	Label        string `json:"label,omitempty"`
	Source       string `json:"source,omitempty"`
	FSType       string `json:"fsType,omitempty"`
	Discovered   bool   `json:"discovered"`
	Available    bool   `json:"available"`
	IsHome       bool   `json:"isHome"`
}

type RootGuard struct {
	roots []Root
}

func NewRootGuard(roots []string) (*RootGuard, error) {
	mapped := make([]Root, 0, len(roots))
	for _, root := range roots {
		mapped = append(mapped, Root{Path: root, InternalPath: root, Available: true})
	}
	return NewRootGuardWithRoots(mapped)
}

func NewRootGuardWithRoots(roots []Root) (*RootGuard, error) {
	if len(roots) == 0 {
		return nil, errors.New("at least one root is required")
	}

	cleaned := make([]Root, 0, len(roots))
	seen := map[string]bool{}
	for _, root := range roots {
		if strings.TrimSpace(root.Path) == "" {
			continue
		}
		publicPath, err := CleanAbs(root.Path)
		if err != nil {
			return nil, err
		}
		internalPath := root.InternalPath
		if strings.TrimSpace(internalPath) == "" {
			internalPath = publicPath
		}
		internalPath, err = CleanAbs(internalPath)
		if err != nil {
			return nil, err
		}
		if seen[publicPath] {
			continue
		}
		seen[publicPath] = true
		root.Path = publicPath
		root.InternalPath = internalPath
		if _, err := os.Stat(internalPath); err == nil {
			root.Available = true
		}
		cleaned = append(cleaned, root)
	}
	if len(cleaned) == 0 {
		return nil, errors.New("at least one root is required")
	}
	sort.Slice(cleaned, func(i, j int) bool {
		if cleaned[i].Path == "/" {
			return true
		}
		if cleaned[j].Path == "/" {
			return false
		}
		return cleaned[i].Path < cleaned[j].Path
	})

	return &RootGuard{roots: cleaned}, nil
}

func (g *RootGuard) Roots() []string {
	roots := make([]string, len(g.roots))
	for i, root := range g.roots {
		roots[i] = root.Path
	}
	return roots
}

func (g *RootGuard) RootEntries() []Root {
	roots := make([]Root, len(g.roots))
	copy(roots, g.roots)
	return roots
}

func (g *RootGuard) Resolve(input string) (string, error) {
	publicPath, err := cleanPublicInput(input)
	if err != nil {
		return "", err
	}

	var best *Root
	for _, root := range g.roots {
		if !PathInside(root.Path, publicPath) {
			continue
		}
		if best == nil || len(root.Path) > len(best.Path) {
			item := root
			best = &item
		}
	}
	if best == nil {
		return "", ErrOutsideRoots
	}
	rel, err := filepath.Rel(best.Path, publicPath)
	if err != nil {
		return "", err
	}
	internal := best.InternalPath
	if rel != "." {
		internal = filepath.Join(best.InternalPath, rel)
	}

	resolved := filepath.Clean(internal)

	// Resolve symlinks on the nearest existing ancestor so that
	// paths like root/symlink/newfile (where symlink->/outside) are
	// caught even when the final path does not exist yet.
	if _, err := os.Lstat(resolved); err == nil {
		// Path exists — evaluate its symlinks directly.
		if evaluated, err := filepath.EvalSymlinks(resolved); err == nil {
			resolved = filepath.Clean(evaluated)
		}
	} else {
		// Walk up until we find an existing ancestor.
		dir := resolved
		for {
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			if _, err := os.Lstat(parent); err == nil {
				if evaluated, err := filepath.EvalSymlinks(parent); err == nil {
					rel, relErr := filepath.Rel(parent, resolved)
					if relErr == nil {
						resolved = filepath.Join(filepath.Clean(evaluated), rel)
					}
				}
				break
			}
			dir = parent
		}
	}

	resolved = filepath.Clean(resolved)
	if PathInside(best.InternalPath, resolved) {
		return resolved, nil
	}
	return "", ErrOutsideRoots
}

func (g *RootGuard) PublicPath(internal string) (string, error) {
	internalPath, err := CleanAbs(internal)
	if err != nil {
		return "", err
	}
	var best *Root
	for _, root := range g.roots {
		if !PathInside(root.InternalPath, internalPath) {
			continue
		}
		if best == nil || len(root.InternalPath) > len(best.InternalPath) {
			item := root
			best = &item
		}
	}
	if best == nil {
		return "", ErrOutsideRoots
	}
	rel, err := filepath.Rel(best.InternalPath, internalPath)
	if err != nil {
		return "", err
	}
	if rel == "." {
		return best.Path, nil
	}
	return filepath.Join(best.Path, rel), nil
}

func (g *RootGuard) IsRoot(path string) bool {
	publicPath, publicErr := cleanPublicInput(path)
	internalPath, internalErr := CleanAbs(path)
	for _, root := range g.roots {
		if publicErr == nil && publicPath == root.Path {
			return true
		}
		if internalErr == nil && internalPath == root.InternalPath {
			return true
		}
	}
	return false
}

func (g *RootGuard) RootFor(path string) (Root, bool) {
	publicPath, publicErr := cleanPublicInput(path)
	internalPath, internalErr := CleanAbs(path)
	var best *Root
	for _, root := range g.roots {
		if publicErr == nil && PathInside(root.Path, publicPath) && (best == nil || len(root.Path) > len(best.Path)) {
			item := root
			best = &item
		}
		if internalErr == nil && PathInside(root.InternalPath, internalPath) && (best == nil || len(root.InternalPath) > len(best.InternalPath)) {
			item := root
			best = &item
		}
	}
	if best == nil {
		return Root{}, false
	}
	return *best, true
}

func (g *RootGuard) internalRelative(path string) (Root, string, error) {
	cleaned, err := CleanAbs(path)
	if err != nil {
		return Root{}, "", err
	}
	var best *Root
	for _, root := range g.roots {
		if PathInside(root.InternalPath, cleaned) && (best == nil || len(root.InternalPath) > len(best.InternalPath)) {
			item := root
			best = &item
		}
	}
	if best == nil {
		return Root{}, "", ErrOutsideRoots
	}
	rel, err := filepath.Rel(best.InternalPath, cleaned)
	if err != nil || rel == "." {
		return Root{}, "", ErrOutsideRoots
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return Root{}, "", ErrOutsideRoots
	}
	return *best, rel, nil
}

func cleanPublicInput(input string) (string, error) {
	if strings.TrimSpace(input) == "" {
		return "", ErrEmptyPath
	}
	if containsTraversal(input) {
		return "", ErrPathTraversal
	}
	return CleanAbs(input)
}

func CleanAbs(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func ValidBaseName(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && name == filepath.Base(name) && name != "." && name != ".."
}

func containsTraversal(input string) bool {
	for _, part := range strings.Split(filepath.Clean(input), string(filepath.Separator)) {
		if part == ".." {
			return true
		}
	}
	return false
}

func PathInside(root, path string) bool {
	if path == root {
		return true
	}
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	return rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func NextAvailablePath(path string) (string, error) {
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return path, nil
	} else if err != nil {
		return "", err
	}
	ext := filepath.Ext(path)
	base := path[:len(path)-len(ext)]
	for i := 1; i <= 1000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("could not find available name for %s", path)
}
