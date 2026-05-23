package files

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/security"
)

func testCache() *DirSizeCache {
	return NewDirSizeCache(0)
}

func TestListReturnsDirectoryEntry(t *testing.T) {
	root := t.TempDir()
	folder := filepath.Join(root, "folder")
	if err := os.MkdirAll(folder, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(folder, "a.txt"), []byte("12345"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}

	entries, err := NewService(guard, testCache()).List(root, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Type != "directory" {
		t.Fatalf("expected directory type, got %s", entries[0].Type)
	}
	if entries[0].Name != "folder" {
		t.Fatalf("expected folder name, got %s", entries[0].Name)
	}
}

func TestComputeDirSizes(t *testing.T) {
	root := t.TempDir()
	folder := filepath.Join(root, "folder")
	nested := filepath.Join(folder, "nested")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(folder, "a.txt"), []byte("12345"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nested, "b.txt"), []byte("123"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path:         "/",
		InternalPath: root,
		Label:        "test",
	}})
	if err != nil {
		t.Fatal(err)
	}

	cache := testCache()
	svc := NewService(guard, cache)

	svc.computeDirSizes([]string{"/folder"})

	got, ok := cache.Get("/folder")
	if !ok {
		t.Fatal("expected cached size for /folder")
	}
	if got != 5 {
		t.Fatalf("expected immediate directory size 5, got %d", got)
	}
}

func TestListShowsHiddenFiles(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".hidden"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "visible.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	entries, err := s.List(root, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name != "visible.txt" {
		t.Fatalf("expected 1 visible entry, got %#v", entries)
	}

	entries, err = s.List(root, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries with hidden, got %d", len(entries))
	}
}

func TestCreateFolder(t *testing.T) {
	root := t.TempDir()
	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	entry, err := s.CreateFolder(root, "newdir")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Name != "newdir" || entry.Type != "directory" {
		t.Fatalf("unexpected entry: %#v", entry)
	}
	if _, err := os.Stat(entry.Path); os.IsNotExist(err) {
		t.Fatal("created folder does not exist")
	}

	if _, err := s.CreateFolder(root, "newdir"); err != ErrDestinationExists {
		t.Fatalf("expected ErrDestinationExists, got %v", err)
	}

	if _, err := s.CreateFolder(root, "../outside"); err == nil {
		t.Fatal("expected error for path traversal")
	}

	if _, err := s.CreateFolder(root, ""); err != ErrInvalidName {
		t.Fatalf("expected ErrInvalidName, got %v", err)
	}
}

func TestRename(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "old.txt"), []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	entry, err := s.Rename(filepath.Join(root, "old.txt"), "new.txt")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Name != "new.txt" {
		t.Fatalf("expected new.txt, got %s", entry.Name)
	}
	if _, err := os.Stat(filepath.Join(root, "old.txt")); !os.IsNotExist(err) {
		t.Fatal("old name should not exist")
	}
	if _, err := os.Stat(filepath.Join(root, "new.txt")); os.IsNotExist(err) {
		t.Fatal("new name should exist")
	}

	if _, err := s.Rename(filepath.Join(root, "new.txt"), "new.txt"); err != ErrDestinationExists {
		t.Fatalf("expected ErrDestinationExists, got %v", err)
	}

	if _, err := s.Rename(root, "renamed"); err != ErrRootOperation {
		t.Fatalf("expected ErrRootOperation, got %v", err)
	}
}

func TestChmod(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "file.txt")
	if err := os.WriteFile(path, []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	entry, err := s.Chmod(path, "rwx------")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Permissions != "-rwx------" {
		t.Fatalf("expected -rwx------, got %s", entry.Permissions)
	}

	if _, err := s.Chmod(path, "invalid"); err == nil {
		t.Fatal("expected error for invalid mode")
	}

	if _, err := s.Chmod(root, "rwxr-xr-x"); err != ErrRootOperation {
		t.Fatalf("expected ErrRootOperation on root chmod, got %v", err)
	}
}

func TestTrashAndRestore(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "note.txt")
	if err := os.WriteFile(path, []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(guard, testCache())

	trashEntry, err := service.Trash(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("expected original path to be moved, got %v", err)
	}
	if _, err := os.Stat(trashEntry.TrashPath); err != nil {
		t.Fatalf("expected trashed file to exist: %v", err)
	}

	entries, err := service.ListTrash()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].ID != trashEntry.ID {
		t.Fatalf("expected trashed entry %q, got %#v", trashEntry.ID, entries)
	}

	restored, err := service.RestoreTrash(trashEntry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if restored.Path != path {
		t.Fatalf("expected restored path %q, got %q", path, restored.Path)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected restored file to exist: %v", err)
	}
}

func TestDeleteTrashPermanentlyRemovesEntry(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "old.txt")
	if err := os.WriteFile(path, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(guard, testCache())

	trashEntry, err := service.Trash(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteTrash(trashEntry.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(trashEntry.TrashPath); !os.IsNotExist(err) {
		t.Fatalf("expected trash path to be removed, got %v", err)
	}
	entries, err := service.ListTrash()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected empty trash, got %#v", entries)
	}
}

func TestDownloadPath(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "file.txt")
	if err := os.WriteFile(path, []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	resolved, info, err := s.DownloadPath(path)
	if err != nil {
		t.Fatal(err)
	}
	if resolved != path {
		t.Fatalf("expected %q, got %q", path, resolved)
	}
	if info.IsDir() {
		t.Fatal("expected file info")
	}

	if _, _, err := s.DownloadPath(root); err != ErrDirectoryDownload {
		t.Fatalf("expected ErrDirectoryDownload for directory, got %v", err)
	}

	if _, _, err := s.DownloadPath(filepath.Join(root, "nonexistent")); !os.IsNotExist(err) {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func TestSearch(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "hello.txt"), []byte("hello world\nfoo bar"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "goodbye.txt"), []byte("goodbye world"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	results, err := s.Search("hello", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result for 'hello', got %d", len(results))
	}

	results, err = s.Search("txt", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results for 'txt', got %d", len(results))
	}

	results, err = s.Search("nonexistent", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(results))
	}
}

func TestEntryFromPath(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "test.txt")
	if err := os.WriteFile(path, []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(guard, testCache())

	entry, err := service.entryFromPath(path)
	if err != nil {
		t.Fatal(err)
	}
	if entry.Name != "test.txt" || entry.Type != "file" {
		t.Fatalf("unexpected entry: %#v", entry)
	}
	if entry.Permissions == "" {
		t.Fatal("expected non-empty permissions")
	}

	dirPath := filepath.Join(root, "subdir")
	if err := os.Mkdir(dirPath, 0o755); err != nil {
		t.Fatal(err)
	}
	entry, err = service.entryFromPath(dirPath)
	if err != nil {
		t.Fatal(err)
	}
	if entry.Type != "directory" {
		t.Fatalf("expected directory type, got %s", entry.Type)
	}
}

func TestServiceUsesPublicPathsWithHostMapping(t *testing.T) {
	hostRoot := t.TempDir()
	if err := os.MkdirAll(filepath.Join(hostRoot, "mnt/disk"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(hostRoot, "mnt/disk/file.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path:         "/mnt/disk",
		InternalPath: filepath.Join(hostRoot, "mnt/disk"),
		Label:        "disk",
		Discovered:   true,
	}})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(guard, testCache())

	entries, err := service.List("/mnt/disk", false)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Path != "/mnt/disk/file.txt" {
		t.Fatalf("expected public path in entries, got %#v", entries)
	}

	roots := service.RootUsage()
	if len(roots) != 1 || roots[0].Path != "/mnt/disk" || !roots[0].Discovered {
		t.Fatalf("expected public discovered root, got %#v", roots)
	}
}
