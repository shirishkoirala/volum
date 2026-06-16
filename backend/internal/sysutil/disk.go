package sysutil

import "syscall"

func DiskUsage(path string) (total, free, used int64, err error) {
	var stat syscall.Statfs_t
	if err = syscall.Statfs(path, &stat); err != nil {
		return 0, 0, 0, err
	}
	blockSize := uint64(stat.Bsize)
	total = int64(min(stat.Blocks*blockSize, uint64(1<<63-1)))
	free = int64(min(stat.Bavail*blockSize, uint64(1<<63-1)))
	used = max(total-free, 0)
	return total, free, used, nil
}
