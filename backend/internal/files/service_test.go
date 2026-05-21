package files

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/security"
)

func TestListReportsRecursiveDirectorySize(t *testing.T) {
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

	guard, err := security.NewRootGuard([]string{root})
	if err != nil {
		t.Fatal(err)
	}

	entries, err := NewService(guard).List(root, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Size != 8 {
		t.Fatalf("expected recursive directory size 8, got %d", entries[0].Size)
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
	service := NewService(guard)

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
	service := NewService(guard)

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
