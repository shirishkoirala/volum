package security

import (
	"errors"
	"fmt"
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

func TestCleanAbs(t *testing.T) {
	path, err := CleanAbs("/foo/bar/../baz")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/foo/baz" {
		t.Fatalf("expected /foo/baz, got %s", path)
	}
}

func TestValidBaseName(t *testing.T) {
	cases := []struct {
		name  string
		valid bool
	}{
		{"file.txt", true},
		{"my file.pdf", true},
		{"", false},
		{".", false},
		{"..", false},
		{"  ", false},
		{"path/with/slash", false},
		{"/etc/passwd", false},
	}
	for _, tc := range cases {
		got := ValidBaseName(tc.name)
		if got != tc.valid {
			t.Errorf("ValidBaseName(%q) = %v, want %v", tc.name, got, tc.valid)
		}
	}
}

func TestPathInside(t *testing.T) {
	if !PathInside("/root", "/root") {
		t.Error("expected root to be inside root")
	}
	if !PathInside("/root", "/root/sub") {
		t.Error("expected subpath to be inside root")
	}
	if PathInside("/root", "/other") {
		t.Error("expected other path to not be inside root")
	}
	if PathInside("/root", "/root/../outside") {
		t.Error("expected traversal to not be inside root")
	}
}

func TestIsRoot(t *testing.T) {
	g, err := NewRootGuard([]string{"/storage", "/media"})
	if err != nil {
		t.Fatal(err)
	}
	if !g.IsRoot("/storage") {
		t.Error("expected /storage to be a root")
	}
	if !g.IsRoot("/media") {
		t.Error("expected /media to be a root")
	}
	if g.IsRoot("/storage/sub") {
		t.Error("expected /storage/sub to not be a root")
	}
	if g.IsRoot("/other") {
		t.Error("expected /other to not be a root")
	}
}

func TestRootFor(t *testing.T) {
	g, err := NewRootGuard([]string{"/storage", "/media"})
	if err != nil {
		t.Fatal(err)
	}
	root, ok := g.RootFor("/storage/file.txt")
	if !ok || root.Path != "/storage" {
		t.Errorf("expected /storage root, got %#v", root)
	}
	_, ok = g.RootFor("/other")
	if ok {
		t.Error("expected no root for /other")
	}
}

func TestNextAvailablePath(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "file.txt")
	got, err := NextAvailablePath(p)
	if err != nil {
		t.Fatal(err)
	}
	if got != p {
		t.Errorf("expected original path, got %s", got)
	}

	os.WriteFile(p, []byte("content"), 0o644)
	got, err = NextAvailablePath(p)
	if err != nil {
		t.Fatal(err)
	}
	expected := filepath.Join(dir, "file (1).txt")
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}

	for i := 1; i <= 5; i++ {
		n := filepath.Join(dir, fmt.Sprintf("file (%d).txt", i))
		os.WriteFile(n, []byte("content"), 0o644)
	}
	got, err = NextAvailablePath(p)
	if err != nil {
		t.Fatal(err)
	}
	expected = filepath.Join(dir, "file (6).txt")
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}
}

func TestNextAvailablePathDir(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "folder")
	os.MkdirAll(p, 0o755)

	got, err := NextAvailablePath(p)
	if err != nil {
		t.Fatal(err)
	}
	expected := filepath.Join(dir, "folder (1)")
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}
}

func TestNextAvailablePathExhausted(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "file.txt")
	for i := 0; i <= 1000; i++ {
		name := "file.txt"
		if i > 0 {
			name = fmt.Sprintf("file (%d).txt", i)
		}
		os.WriteFile(filepath.Join(dir, name), []byte("content"), 0o644)
	}
	_, err := NextAvailablePath(p)
	if err == nil {
		t.Fatal("expected error after exhausting candidates")
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

func TestRootGuardCreateFileRejectsSymlinkParent(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Fatal(err)
	}
	guard, err := NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}

	file, err := guard.CreateFile(filepath.Join(root, "escape", "created.txt"), 0o644)
	if file != nil {
		file.Close()
	}
	if err == nil {
		t.Fatal("expected descriptor-relative create beneath symlink to fail")
	}
	if _, err := os.Stat(filepath.Join(outside, "created.txt")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected no file outside root, got %v", err)
	}
}
