package files

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type DiskUsageNode struct {
	Name       string          `json:"name"`
	Path       string          `json:"path"`
	Size       int64           `json:"size"`
	IsDir      bool            `json:"isDir"`
	Percentage float64         `json:"percentage"`
	Children   []DiskUsageNode `json:"children"`
}

func (s *Service) AnalyzeDiskUsage(publicPath string) (*DiskUsageNode, error) {
	internalPath, err := s.guard.Resolve(publicPath)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(internalPath)
	if err != nil {
		return nil, err
	}

	if !info.IsDir() {
		return &DiskUsageNode{
			Name: info.Name(),
			Path: publicPath,
			Size: info.Size(),
		}, nil
	}

	root := &DiskUsageNode{
		Name:  filepath.Base(publicPath),
		Path:  publicPath,
		IsDir: true,
	}

	s.walkDiskUsage(internalPath, publicPath, root, 0)

	if root.Size > 0 {
		computePercentages(root, root.Size)
	}

	return root, nil
}

func (s *Service) walkDiskUsage(internalPath, publicPath string, parent *DiskUsageNode, depth int) {
	if depth > 4 {
		return
	}

	entries, err := os.ReadDir(internalPath)
	if err != nil {
		return
	}

	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || name == ".volum-trash" || name == ".volum-tmp" {
			if entry.IsDir() {
				continue
			}
			continue
		}

		childInternal := filepath.Join(internalPath, name)
		childPublic := filepath.Join(publicPath, name)

		info, err := os.Stat(childInternal)
		if err != nil {
			continue
		}

		node := DiskUsageNode{
			Name:  name,
			Path:  childPublic,
			IsDir: info.IsDir(),
		}

		if info.IsDir() {
			s.walkDiskUsage(childInternal, childPublic, &node, depth+1)
		} else {
			node.Size = info.Size()
		}

		parent.Size += node.Size
		parent.Children = append(parent.Children, node)
	}

	sortChildrenBySize(parent)
	limitChildren(parent, 50)
}

func sortChildrenBySize(parent *DiskUsageNode) {
	sort.Slice(parent.Children, func(i, j int) bool {
		return parent.Children[i].Size > parent.Children[j].Size
	})
}

func limitChildren(parent *DiskUsageNode, max int) {
	if len(parent.Children) > max {
		parent.Children = parent.Children[:max]
	}
}

func computePercentages(node *DiskUsageNode, total int64) {
	if total > 0 {
		node.Percentage = float64(node.Size) / float64(total) * 100
	}
	for i := range node.Children {
		computePercentages(&node.Children[i], total)
	}
}
