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

func TestDirSizeCacheGetMap(t *testing.T) {
	c := NewDirSizeCache(0)
	c.Set("/a", 10)
	c.Set("/b", 20)
	c.Set("/c", 30)

	result := c.GetMap([]string{"/a", "/b", "/d"})
	if len(result) != 2 {
		t.Fatalf("expected 2 results, got %d", len(result))
	}
	if result["/a"] != 10 || result["/b"] != 20 {
		t.Errorf("unexpected values: %#v", result)
	}
	if _, ok := result["/d"]; ok {
		t.Error("expected /d to be missing")
	}
}

func TestDirSizeCacheGetMapSkipsExpired(t *testing.T) {
	c := NewDirSizeCache(50 * time.Millisecond)
	c.Set("/a", 10)
	c.Set("/b", 20)
	time.Sleep(100 * time.Millisecond)

	result := c.GetMap([]string{"/a", "/b"})
	if len(result) != 0 {
		t.Errorf("expected 0 results, got %d", len(result))
	}
}

func TestDirSizeCachePurgeExpired(t *testing.T) {
	c := NewDirSizeCache(50 * time.Millisecond)
	c.Set("/fresh", 100)
	time.Sleep(10 * time.Millisecond)
	c.Set("/stale", 200)
	time.Sleep(60 * time.Millisecond)

	c.PurgeExpired()
	if _, ok := c.Get("/stale"); ok {
		t.Error("expected /stale to be purged")
	}
	if _, ok := c.Get("/fresh"); ok {
		t.Error("expected /fresh to also be expired and purged")
	}
}

func TestDirSizeCachePurgeExpiredNoTTL(t *testing.T) {
	c := NewDirSizeCache(0)
	c.Set("/keep", 42)
	c.PurgeExpired()
	_, ok := c.Get("/keep")
	if !ok {
		t.Fatal("expected entry to be kept when TTL is 0")
	}
}
