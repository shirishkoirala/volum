package files

import (
	"sync"
	"time"
)

type dirSizeEntry struct {
	size       int64
	computedAt time.Time
}

type DirSizeCache struct {
	mu   sync.RWMutex
	data map[string]dirSizeEntry
	ttl  time.Duration
}

func NewDirSizeCache(ttl time.Duration) *DirSizeCache {
	return &DirSizeCache{
		data: make(map[string]dirSizeEntry),
		ttl:  ttl,
	}
}

func (c *DirSizeCache) Get(publicPath string) (int64, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.data[publicPath]
	if !ok {
		return 0, false
	}
	if c.ttl > 0 && time.Since(e.computedAt) > c.ttl {
		return 0, false
	}
	return e.size, true
}

func (c *DirSizeCache) Set(publicPath string, size int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[publicPath] = dirSizeEntry{size: size, computedAt: time.Now()}
}
