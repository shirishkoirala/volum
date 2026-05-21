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
