//go:build linux

package security

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

const mutationResolveFlags = unix.RESOLVE_BENEATH | unix.RESOLVE_NO_SYMLINKS

func openMutationRoot(root Root) (int, error) {
	fd, err := unix.Open(root.InternalPath, unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return -1, fmt.Errorf("open configured root: %w", err)
	}
	return fd, nil
}

func openMutationDirs(rootFD int, parts []string, create bool) (int, error) {
	currentFD, err := unix.Dup(rootFD)
	if err != nil {
		return -1, err
	}
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		how := &unix.OpenHow{Flags: unix.O_PATH | unix.O_DIRECTORY | unix.O_CLOEXEC, Resolve: mutationResolveFlags}
		nextFD, openErr := unix.Openat2(currentFD, part, how)
		if create && errors.Is(openErr, unix.ENOENT) {
			if mkdirErr := unix.Mkdirat(currentFD, part, 0o755); mkdirErr != nil && !errors.Is(mkdirErr, unix.EEXIST) {
				unix.Close(currentFD)
				return -1, mkdirErr
			}
			nextFD, openErr = unix.Openat2(currentFD, part, how)
		}
		if openErr != nil {
			unix.Close(currentFD)
			return -1, fmt.Errorf("unsafe mutation path component %s: %w", part, openErr)
		}
		unix.Close(currentFD)
		currentFD = nextFD
	}
	return currentFD, nil
}

func (g *RootGuard) mutationParent(path string, create bool) (int, string, error) {
	root, rel, err := g.internalRelative(path)
	if err != nil {
		return -1, "", err
	}
	parts := strings.Split(rel, string(filepath.Separator))
	rootFD, err := openMutationRoot(root)
	if err != nil {
		return -1, "", err
	}
	defer unix.Close(rootFD)
	parentFD, err := openMutationDirs(rootFD, parts[:len(parts)-1], create)
	if err != nil {
		return -1, "", err
	}
	return parentFD, parts[len(parts)-1], nil
}

func (g *RootGuard) CreateFile(path string, perm os.FileMode) (*os.File, error) {
	return g.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm)
}

func (g *RootGuard) OpenFile(path string, flags int, perm os.FileMode) (*os.File, error) {
	parentFD, name, err := g.mutationParent(path, false)
	if err != nil {
		return nil, err
	}
	defer unix.Close(parentFD)
	how := &unix.OpenHow{
		Flags:   uint64(flags | unix.O_CLOEXEC | unix.O_NOFOLLOW),
		Mode:    uint64(perm.Perm()),
		Resolve: mutationResolveFlags,
	}
	fd, err := unix.Openat2(parentFD, name, how)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), name), nil
}

func (g *RootGuard) Mkdir(path string, perm os.FileMode) error {
	parentFD, name, err := g.mutationParent(path, false)
	if err != nil {
		return err
	}
	defer unix.Close(parentFD)
	return unix.Mkdirat(parentFD, name, uint32(perm.Perm()))
}

func (g *RootGuard) MkdirAll(path string, _ os.FileMode) error {
	if g.IsRoot(path) {
		return nil
	}
	root, rel, err := g.internalRelative(path)
	if err != nil {
		return err
	}
	rootFD, err := openMutationRoot(root)
	if err != nil {
		return err
	}
	defer unix.Close(rootFD)
	dirFD, err := openMutationDirs(rootFD, strings.Split(rel, string(filepath.Separator)), true)
	if err != nil {
		return err
	}
	return unix.Close(dirFD)
}

func (g *RootGuard) RenameNoReplace(source, destination string) error {
	sourceParent, sourceName, err := g.mutationParent(source, false)
	if err != nil {
		return err
	}
	defer unix.Close(sourceParent)
	destinationParent, destinationName, err := g.mutationParent(destination, false)
	if err != nil {
		return err
	}
	defer unix.Close(destinationParent)
	return unix.Renameat2(sourceParent, sourceName, destinationParent, destinationName, unix.RENAME_NOREPLACE)
}

func (g *RootGuard) Chmod(path string, mode os.FileMode) error {
	parentFD, name, err := g.mutationParent(path, false)
	if err != nil {
		return err
	}
	defer unix.Close(parentFD)
	how := &unix.OpenHow{Flags: unix.O_RDONLY | unix.O_CLOEXEC | unix.O_NOFOLLOW | unix.O_NONBLOCK, Resolve: mutationResolveFlags}
	fd, err := unix.Openat2(parentFD, name, how)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	return unix.Fchmod(fd, uint32(mode.Perm()))
}

func removeMutationAt(parentFD int, name string) error {
	var stat unix.Stat_t
	if err := unix.Fstatat(parentFD, name, &stat, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		return err
	}
	if stat.Mode&unix.S_IFMT != unix.S_IFDIR {
		return unix.Unlinkat(parentFD, name, 0)
	}
	how := &unix.OpenHow{Flags: unix.O_RDONLY | unix.O_DIRECTORY | unix.O_CLOEXEC, Resolve: mutationResolveFlags}
	fd, err := unix.Openat2(parentFD, name, how)
	if err != nil {
		return err
	}
	directory := os.NewFile(uintptr(fd), name)
	entries, readErr := directory.ReadDir(-1)
	if readErr == nil {
		for _, entry := range entries {
			if err := removeMutationAt(fd, entry.Name()); err != nil {
				readErr = err
				break
			}
		}
	}
	_ = directory.Close()
	if readErr != nil {
		return readErr
	}
	return unix.Unlinkat(parentFD, name, unix.AT_REMOVEDIR)
}

func (g *RootGuard) RemoveAll(path string) error {
	parentFD, name, err := g.mutationParent(path, false)
	if err != nil {
		if errors.Is(err, unix.ENOENT) {
			return nil
		}
		return err
	}
	defer unix.Close(parentFD)
	err = removeMutationAt(parentFD, name)
	if errors.Is(err, unix.ENOENT) {
		return nil
	}
	return err
}

func (g *RootGuard) Remove(path string) error {
	parentFD, name, err := g.mutationParent(path, false)
	if err != nil {
		return err
	}
	defer unix.Close(parentFD)
	var stat unix.Stat_t
	if err := unix.Fstatat(parentFD, name, &stat, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		return err
	}
	flags := 0
	if stat.Mode&unix.S_IFMT == unix.S_IFDIR {
		flags = unix.AT_REMOVEDIR
	}
	return unix.Unlinkat(parentFD, name, flags)
}
