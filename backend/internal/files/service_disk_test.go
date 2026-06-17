package files

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/security"
)

func TestAnalyzeDiskUsageFile(t *testing.T) {
	root := t.TempDir()
	f := filepath.Join(root, "file.txt")
	os.WriteFile(f, []byte("hello world"), 0o644)

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path: "/", InternalPath: root,
	}})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	node, err := s.AnalyzeDiskUsage("/file.txt")
	if err != nil {
		t.Fatal(err)
	}
	if node.Name != "file.txt" || node.Size != 11 || node.IsDir {
		t.Errorf("unexpected node: %#v", node)
	}
}

func TestAnalyzeDiskUsageDirectory(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "a.txt"), []byte("aaaaa"), 0o644)
	os.WriteFile(filepath.Join(root, "b.txt"), []byte("bbbbb"), 0o644)
	os.MkdirAll(filepath.Join(root, "sub"), 0o755)
	os.WriteFile(filepath.Join(root, "sub/c.txt"), []byte("cc"), 0o644)

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path: "/", InternalPath: root,
	}})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	node, err := s.AnalyzeDiskUsage("/")
	if err != nil {
		t.Fatal(err)
	}
	if !node.IsDir {
		t.Fatal("expected directory node")
	}
	if node.Size != 12 {
		t.Fatalf("expected total size 12, got %d", node.Size)
	}
	if len(node.Children) != 3 {
		t.Fatalf("expected 3 children, got %d", len(node.Children))
	}
	if node.Children[0].Size < node.Children[1].Size {
		t.Error("expected children sorted by size descending")
	}
}

func TestAnalyzeDiskUsageFiltersHidden(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "visible.txt"), []byte("hello"), 0o644)
	os.MkdirAll(filepath.Join(root, ".hidden"), 0o755)
	os.WriteFile(filepath.Join(root, ".hidden/x.txt"), []byte("secret"), 0o644)

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path: "/", InternalPath: root,
	}})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	node, err := s.AnalyzeDiskUsage("/")
	if err != nil {
		t.Fatal(err)
	}
	if node.Size != 5 {
		t.Fatalf("expected size 5 (only visible file), got %d", node.Size)
	}
}

func TestAnalyzeDiskUsageFiltersVolumDirs(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "ok.txt"), []byte("data"), 0o644)
	os.MkdirAll(filepath.Join(root, ".volum-trash"), 0o755)
	os.WriteFile(filepath.Join(root, ".volum-trash/x.txt"), []byte("trash"), 0o644)

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path: "/", InternalPath: root,
	}})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	node, err := s.AnalyzeDiskUsage("/")
	if err != nil {
		t.Fatal(err)
	}
	if node.Size != 4 {
		t.Fatalf("expected size 4 (only ok.txt), got %d", node.Size)
	}
}

func TestAnalyzeDiskUsageRespectsDepth(t *testing.T) {
	root := t.TempDir()
	d1 := filepath.Join(root, "l1")
	d2 := filepath.Join(d1, "l2")
	d3 := filepath.Join(d2, "l3")
	d4 := filepath.Join(d3, "l4")
	d5 := filepath.Join(d4, "l5")
	os.MkdirAll(d5, 0o755)
	os.WriteFile(filepath.Join(d5, "deep.txt"), []byte("x"), 0o644)

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path: "/", InternalPath: root,
	}})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	node, err := s.AnalyzeDiskUsage("/")
	if err != nil {
		t.Fatal(err)
	}
	if len(node.Children) != 1 {
		t.Fatalf("expected 1 child (l1), got %d", len(node.Children))
	}
}

func TestAnalyzeDiskUsageLimitsChildren(t *testing.T) {
	root := t.TempDir()
	for i := 0; i < 60; i++ {
		os.WriteFile(filepath.Join(root, fmt.Sprintf("f%d.txt", i)), []byte("x"), 0o644)
	}

	guard, err := security.NewRootGuardWithRoots([]security.Root{{
		Path: "/", InternalPath: root,
	}})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(guard, testCache())

	node, err := s.AnalyzeDiskUsage("/")
	if err != nil {
		t.Fatal(err)
	}
	if len(node.Children) > 50 {
		t.Fatalf("expected at most 50 children, got %d", len(node.Children))
	}
}

func TestSortChildrenBySize(t *testing.T) {
	parent := &DiskUsageNode{
		Children: []DiskUsageNode{
			{Name: "small", Size: 10},
			{Name: "big", Size: 100},
			{Name: "medium", Size: 50},
		},
	}
	sortChildrenBySize(parent)
	if parent.Children[0].Name != "big" || parent.Children[2].Name != "small" {
		t.Errorf("unexpected order: %#v", parent.Children)
	}
}

func TestLimitChildren(t *testing.T) {
	parent := &DiskUsageNode{}
	for i := 0; i < 10; i++ {
		parent.Children = append(parent.Children, DiskUsageNode{Name: "x"})
	}
	limitChildren(parent, 3)
	if len(parent.Children) != 3 {
		t.Fatalf("expected 3 children, got %d", len(parent.Children))
	}
}

func TestComputePercentages(t *testing.T) {
	parent := &DiskUsageNode{
		Size: 100,
		Children: []DiskUsageNode{
			{Size: 50},
			{Size: 25},
		},
	}
	computePercentages(parent, 100)
	if parent.Percentage != 100 {
		t.Errorf("expected 100%%, got %f", parent.Percentage)
	}
	if parent.Children[0].Percentage != 50 || parent.Children[1].Percentage != 25 {
		t.Errorf("unexpected child percentages: %#v", parent.Children)
	}
}

func TestComputePercentagesZeroTotal(t *testing.T) {
	parent := &DiskUsageNode{Size: 0}
	computePercentages(parent, 0)
	if parent.Percentage != 0 {
		t.Errorf("expected 0, got %f", parent.Percentage)
	}
}
