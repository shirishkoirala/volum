package security

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewRootGuard(t *testing.T) {
	roots := []string{"/storage", "/data"}
	g, err := NewRootGuard(roots)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Roots()) != 2 {
		t.Fatalf("expected 2 roots, got %d", len(g.Roots()))
	}
}

func TestRootGuardEmptyRoots(t *testing.T) {
	_, err := NewRootGuard(nil)
	if err == nil {
		t.Fatal("expected error for empty roots")
	}
}

func TestRootGuardResolveValid(t *testing.T) {
	g, err := NewRootGuard([]string{"/storage"})
	if err != nil {
		t.Fatal(err)
	}

	path, err := g.Resolve("/storage/folder/file.txt")
	if err != nil {
		t.Fatal(err)
	}
	if path != filepath.Clean("/storage/folder/file.txt") {
		t.Fatalf("unexpected path: %s", path)
	}
}

func TestRootGuardResolveRoot(t *testing.T) {
	g, _ := NewRootGuard([]string{"/storage"})

	path, err := g.Resolve("/storage")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/storage" {
		t.Fatalf("expected /storage, got %s", path)
	}
}

func TestRootGuardResolveOutsideRoot(t *testing.T) {
	g, _ := NewRootGuard([]string{"/storage"})

	_, err := g.Resolve("/etc/passwd")
	if err == nil {
		t.Fatal("expected error for path outside root")
	}
}

func TestRootGuardResolvePathTraversal(t *testing.T) {
	g, _ := NewRootGuard([]string{"/storage"})

	_, err := g.Resolve("/storage/../etc/passwd")
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestRootGuardResolveEmpty(t *testing.T) {
	g, _ := NewRootGuard([]string{"/storage"})

	_, err := g.Resolve("")
	if err == nil {
		t.Fatal("expected error for empty path")
	}
}

func TestRootGuardMultipleRoots(t *testing.T) {
	g, err := NewRootGuard([]string{"/storage", "/backup", "/media"})
	if err != nil {
		t.Fatal(err)
	}

	paths := []string{
		"/storage/docs/file.txt",
		"/backup/2024/dump.sql",
		"/media/photos/vacation.jpg",
	}
	for _, p := range paths {
		if _, err := g.Resolve(p); err != nil {
			t.Errorf("expected valid path %s, got error: %v", p, err)
		}
	}

	if _, err := g.Resolve("/tmp/outside"); err == nil {
		t.Error("expected error for path outside all roots")
	}
}

func TestRootGuardResolveSymlinkInPath(t *testing.T) {
	g, _ := NewRootGuard([]string{"/storage"})

	_, err := g.Resolve("/storage/valid/../../etc/shadow")
	if err == nil {
		t.Fatal("expected error for traversal with parent dir")
	}
}

func TestRootGuardHostPathMapping(t *testing.T) {
	hostRoot := t.TempDir()
	internalRoot := filepath.Join(hostRoot, "mnt/disk")
	if err := os.MkdirAll(filepath.Join(internalRoot, "folder"), 0o755); err != nil {
		t.Fatal(err)
	}

	g, err := NewRootGuardWithRoots([]Root{{
		Path:         "/mnt/disk",
		InternalPath: internalRoot,
		Label:        "disk",
		Discovered:   true,
	}})
	if err != nil {
		t.Fatal(err)
	}

	resolved, err := g.Resolve("/mnt/disk/folder")
	if err != nil {
		t.Fatal(err)
	}
	if resolved != filepath.Join(internalRoot, "folder") {
		t.Fatalf("expected internal path, got %s", resolved)
	}

	publicPath, err := g.PublicPath(filepath.Join(internalRoot, "folder"))
	if err != nil {
		t.Fatal(err)
	}
	if publicPath != "/mnt/disk/folder" {
		t.Fatalf("expected public path, got %s", publicPath)
	}
}

func TestRootGuardRejectsHostMappingEscape(t *testing.T) {
	hostRoot := t.TempDir()
	internalRoot := filepath.Join(hostRoot, "storage")
	outside := filepath.Join(hostRoot, "outside")
	if err := os.MkdirAll(internalRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(internalRoot, "link")); err != nil {
		t.Fatal(err)
	}

	g, err := NewRootGuardWithRoots([]Root{{Path: "/storage", InternalPath: internalRoot}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := g.Resolve("/storage/link"); err == nil {
		t.Fatal("expected symlink escape to be rejected")
	}
}
