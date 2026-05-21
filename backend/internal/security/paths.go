package security

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

var (
	ErrEmptyPath     = errors.New("path is required")
	ErrPathTraversal = errors.New("path traversal is not allowed")
	ErrOutsideRoots  = errors.New("path is outside configured roots")
)

type RootGuard struct {
	roots []string
}

func NewRootGuard(roots []string) (*RootGuard, error) {
	if len(roots) == 0 {
		return nil, errors.New("at least one root is required")
	}

	cleaned := make([]string, 0, len(roots))
	for _, root := range roots {
		abs, err := filepath.Abs(root)
		if err != nil {
			return nil, err
		}
		cleaned = append(cleaned, filepath.Clean(abs))
	}

	return &RootGuard{roots: cleaned}, nil
}

func (g *RootGuard) Roots() []string {
	roots := make([]string, len(g.roots))
	copy(roots, g.roots)
	return roots
}

func (g *RootGuard) Resolve(input string) (string, error) {
	if strings.TrimSpace(input) == "" {
		return "", ErrEmptyPath
	}
	if containsTraversal(input) {
		return "", ErrPathTraversal
	}

	abs, err := filepath.Abs(input)
	if err != nil {
		return "", err
	}
	clean := filepath.Clean(abs)

	resolved := clean
	if _, err := os.Lstat(clean); err == nil {
		if evaluated, err := filepath.EvalSymlinks(clean); err == nil {
			resolved = filepath.Clean(evaluated)
		}
	}

	for _, root := range g.roots {
		if pathInside(root, resolved) {
			return resolved, nil
		}
	}
	return "", ErrOutsideRoots
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
