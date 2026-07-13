package files

import (
	"testing"
	"time"
)

func TestDirSizeCacheSetGet(t *testing.T) {
	c := NewDirSizeCache(0)
	c.Set("/path/to/dir", 1024)
	size, ok := c.Get("/path/to/dir")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if size != 1024 {
		t.Fatalf("expected 1024, got %d", size)
	}
}

func TestDirSizeCacheGetMiss(t *testing.T) {
	c := NewDirSizeCache(0)
	_, ok := c.Get("/nonexistent")
	if ok {
		t.Fatal("expected cache miss")
	}
}

func TestDirSizeCacheGetExpired(t *testing.T) {
	c := NewDirSizeCache(50 * time.Millisecond)
	c.Set("/path", 2048)
	time.Sleep(100 * time.Millisecond)
	_, ok := c.Get("/path")
	if ok {
		t.Fatal("expected expired entry to be miss")
	}
}

func TestDirSizeCacheNoTTL(t *testing.T) {
	c := NewDirSizeCache(0)
	c.Set("/path", 512)
	time.Sleep(10 * time.Millisecond)
	size, ok := c.Get("/path")
	if !ok {
		t.Fatal("expected hit with no TTL")
	}
	if size != 512 {
		t.Fatalf("expected 512, got %d", size)
	}
}
