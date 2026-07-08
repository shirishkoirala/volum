//go:build !linux

package security

import "os"

func (g *RootGuard) CreateFile(path string, perm os.FileMode) (*os.File, error) {
	return nil, ErrUnsupportedMutation
}

func (g *RootGuard) OpenFile(path string, flags int, perm os.FileMode) (*os.File, error) {
	return nil, ErrUnsupportedMutation
}

func (g *RootGuard) Mkdir(path string, perm os.FileMode) error {
	return ErrUnsupportedMutation
}

func (g *RootGuard) MkdirAll(path string, perm os.FileMode) error {
	if g.IsRoot(path) {
		return nil
	}
	return ErrUnsupportedMutation
}

func (g *RootGuard) RenameNoReplace(source, destination string) error {
	return ErrUnsupportedMutation
}

func (g *RootGuard) Chmod(path string, mode os.FileMode) error {
	return ErrUnsupportedMutation
}

func (g *RootGuard) RemoveAll(path string) error {
	return ErrUnsupportedMutation
}

func (g *RootGuard) Remove(path string) error {
	return ErrUnsupportedMutation
}
