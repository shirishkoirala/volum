package worker

import (
	"fmt"

	"github.com/volum-app/volum/backend/internal/sysutil"
)

var errExtractLimit = fmt.Errorf("archive exceeds extraction limits (max %d bytes, max %d entries)", maxExtractTotalBytes, maxExtractEntries)

const (
	maxExtractTotalBytes = 10 * 1024 * 1024 * 1024 // 10 GB
	maxExtractEntries    = 100_000
	maxExtractPerFile    = 2 * 1024 * 1024 * 1024 // 2 GB
	maxExtractPathDepth  = 100
	minExtractFreeSpace  = 64 * 1024 * 1024
)

func ensureExtractSpace(destination string, required int64) error {
	_, free, _, err := sysutil.DiskUsage(destination)
	if err != nil {
		return fmt.Errorf("check extraction free space: %w", err)
	}
	if required > free-minExtractFreeSpace {
		return fmt.Errorf("%w: extraction requires %d bytes with %d bytes available", errExtractLimit, required, free)
	}
	return nil
}
