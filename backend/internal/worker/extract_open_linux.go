//go:build linux

package worker

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

const extractResolveFlags = unix.RESOLVE_BENEATH | unix.RESOLVE_NO_SYMLINKS

func openExtractRoot(destination string) (int, error) {
	fd, err := unix.Open(destination, unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return -1, fmt.Errorf("open extraction destination: %w", err)
	}
	return fd, nil
}

func openExtractDirs(rootFD int, parts []string) (int, error) {
	currentFD, err := unix.Dup(rootFD)
	if err != nil {
		return -1, err
	}
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		how := &unix.OpenHow{
			Flags:   unix.O_PATH | unix.O_DIRECTORY | unix.O_CLOEXEC,
			Resolve: extractResolveFlags,
		}
		nextFD, openErr := unix.Openat2(currentFD, part, how)
		if errors.Is(openErr, unix.ENOENT) {
			if mkdirErr := unix.Mkdirat(currentFD, part, 0o755); mkdirErr != nil && !errors.Is(mkdirErr, unix.EEXIST) {
				unix.Close(currentFD)
				return -1, mkdirErr
			}
			nextFD, openErr = unix.Openat2(currentFD, part, how)
		}
		if openErr != nil {
			unix.Close(currentFD)
			return -1, fmt.Errorf("%w: directory %s: %v", errUnsafeExtractPath, part, openErr)
		}
		unix.Close(currentFD)
		currentFD = nextFD
	}
	return currentFD, nil
}

func ensureExtractDir(destination, entryName string) error {
	rel, err := cleanExtractEntry(entryName)
	if err != nil || rel == "." {
		return err
	}
	rootFD, err := openExtractRoot(destination)
	if err != nil {
		return err
	}
	defer unix.Close(rootFD)
	dirFD, err := openExtractDirs(rootFD, strings.Split(rel, string(filepath.Separator)))
	if err != nil {
		return err
	}
	return unix.Close(dirFD)
}

func openExtractFile(destination, entryName string) (*os.File, error) {
	rel, err := cleanExtractEntry(entryName)
	if err != nil {
		return nil, err
	}
	if rel == "." {
		return nil, fmt.Errorf("%w: %s", errUnsafeExtractPath, entryName)
	}
	parts := strings.Split(rel, string(filepath.Separator))
	filename := parts[len(parts)-1]

	rootFD, err := openExtractRoot(destination)
	if err != nil {
		return nil, err
	}
	defer unix.Close(rootFD)
	parentFD, err := openExtractDirs(rootFD, parts[:len(parts)-1])
	if err != nil {
		return nil, err
	}
	defer unix.Close(parentFD)

	how := &unix.OpenHow{
		Flags:   unix.O_WRONLY | unix.O_CREAT | unix.O_TRUNC | unix.O_CLOEXEC | unix.O_NOFOLLOW,
		Mode:    0o644,
		Resolve: extractResolveFlags,
	}
	fd, err := unix.Openat2(parentFD, filename, how)
	if err != nil {
		return nil, fmt.Errorf("%w: file %s: %v", errUnsafeExtractPath, entryName, err)
	}
	return os.NewFile(uintptr(fd), filename), nil
}
