package worker

import "fmt"

var errExtractLimit = fmt.Errorf("archive exceeds extraction limits (max %d bytes, max %d entries)", maxExtractTotalBytes, maxExtractEntries)

const (
	maxExtractTotalBytes = 10 * 1024 * 1024 * 1024 // 10 GB
	maxExtractEntries    = 100_000
	maxExtractPerFile    = 2 * 1024 * 1024 * 1024 // 2 GB
	maxExtractPathDepth  = 100
)
