//go:build !linux

package security

import "os"

func (g *RootGuard) CreateFile(path string, perm os.FileMode) (*os.File, error) {
	return g.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm)
}

func (g *RootGuard) OpenFile(path string, flags int, perm os.FileMode) (*os.File, error) {
	resolved, err := g.Resolve(path)
	if err != nil {
		return nil, err
	}
	return os.OpenFile(resolved, flags, perm)
}

func (g *RootGuard) Mkdir(path string, perm os.FileMode) error {
	resolved, err := g.Resolve(path)
	if err != nil {
		return err
	}
	return os.Mkdir(resolved, perm)
}

func (g *RootGuard) MkdirAll(path string, perm os.FileMode) error {
	if g.IsRoot(path) {
		return nil
	}
	resolved, err := g.Resolve(path)
	if err != nil {
		return err
	}
	return os.MkdirAll(resolved, perm)
}

func (g *RootGuard) RenameNoReplace(source, destination string) error {
	sourceResolved, err := g.Resolve(source)
	if err != nil {
		return err
	}
	destinationResolved, err := g.Resolve(destination)
	if err != nil {
		return err
	}
	if _, err := os.Lstat(destinationResolved); err == nil {
		return os.ErrExist
	}
	return os.Rename(sourceResolved, destinationResolved)
}

func (g *RootGuard) Chmod(path string, mode os.FileMode) error {
	resolved, err := g.Resolve(path)
	if err != nil {
		return err
	}
	return os.Chmod(resolved, mode)
}

func (g *RootGuard) RemoveAll(path string) error {
	resolved, err := g.Resolve(path)
	if err != nil {
		return err
	}
	return os.RemoveAll(resolved)
}

func (g *RootGuard) Remove(path string) error {
	resolved, err := g.Resolve(path)
	if err != nil {
		return err
	}
	return os.Remove(resolved)
}
