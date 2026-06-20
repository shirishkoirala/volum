package worker

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

var errUnsafeExtractPath = errors.New("archive entry has an unsafe destination path")

func cleanExtractEntry(entryName string) (string, error) {
	rel := filepath.Clean(filepath.FromSlash(entryName))
	if filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("%w: %s", errUnsafeExtractPath, entryName)
	}
	return rel, nil
}
