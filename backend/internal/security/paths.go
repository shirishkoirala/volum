package security

import (
	"errors"
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
		publicPath, err := cleanAbs(root.Path)
		if err != nil {
			return nil, err
		}
		internalPath := root.InternalPath
		if strings.TrimSpace(internalPath) == "" {
			internalPath = publicPath
		}
		internalPath, err = cleanAbs(internalPath)
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
		if !pathInside(root.Path, publicPath) {
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
	if _, err := os.Lstat(resolved); err == nil {
		if evaluated, err := filepath.EvalSymlinks(resolved); err == nil {
			resolved = filepath.Clean(evaluated)
		}
	}
	if pathInside(best.InternalPath, resolved) {
		return resolved, nil
	}
	return "", ErrOutsideRoots
}

func (g *RootGuard) PublicPath(internal string) (string, error) {
	internalPath, err := cleanAbs(internal)
	if err != nil {
		return "", err
	}
	var best *Root
	for _, root := range g.roots {
		if !pathInside(root.InternalPath, internalPath) {
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
	internalPath, internalErr := cleanAbs(path)
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
	internalPath, internalErr := cleanAbs(path)
	var best *Root
	for _, root := range g.roots {
		if publicErr == nil && pathInside(root.Path, publicPath) && (best == nil || len(root.Path) > len(best.Path)) {
			item := root
			best = &item
		}
		if internalErr == nil && pathInside(root.InternalPath, internalPath) && (best == nil || len(root.InternalPath) > len(best.InternalPath)) {
			item := root
			best = &item
		}
	}
	if best == nil {
		return Root{}, false
	}
	return *best, true
}

func cleanPublicInput(input string) (string, error) {
	if strings.TrimSpace(input) == "" {
		return "", ErrEmptyPath
	}
	if containsTraversal(input) {
		return "", ErrPathTraversal
	}
	return cleanAbs(input)
}

func cleanAbs(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func containsTraversal(input string) bool {
	for _, part := range strings.Split(filepath.Clean(input), string(filepath.Separator)) {
		if part == ".." {
			return true
		}
	}
	return false
}

func pathInside(root, path string) bool {
	if path == root {
		return true
	}
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	return rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
