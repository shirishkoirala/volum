package devices

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"os/exec"
	"strings"
	"syscall"

	"github.com/volum-app/volum/backend/internal/security"
)

type BlockDevice struct {
	Name         string         `json:"name"`
	Size         string         `json:"size"`
	Type         string         `json:"type"`
	MountPoint   string         `json:"mountPoint,omitempty"`
	FSType       string         `json:"fsType,omitempty"`
	Label        string         `json:"label,omitempty"`
	UUID         string         `json:"uuid,omitempty"`
	Model        string         `json:"model,omitempty"`
	Rotational   bool           `json:"rotational"`
	Transport    string         `json:"transport,omitempty"`
	VolumPath    string         `json:"volumPath,omitempty"`
	TotalBytes   int64          `json:"totalBytes,omitempty"`
	UsedBytes    int64          `json:"usedBytes,omitempty"`
	FreeBytes    int64          `json:"freeBytes,omitempty"`
	Partitions   []BlockDevice  `json:"partitions,omitempty"`
}

type lsblkDevice struct {
	Name       string         `json:"name"`
	Size       string         `json:"size"`
	Type       string         `json:"type"`
	MountPoint *string        `json:"mountpoint"`
	FSType     *string        `json:"fstype"`
	Label      *string        `json:"label"`
	UUID       *string        `json:"uuid"`
	Model      *string        `json:"model"`
	Rota       bool           `json:"rota"`
	Tran       *string        `json:"tran"`
	Children   []lsblkDevice  `json:"children,omitempty"`
}

type lsblkOutput struct {
	BlockDevices []lsblkDevice `json:"blockdevices"`
}

func List(roots []security.Root) ([]BlockDevice, error) {
	cmd := exec.Command("lsblk", "-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,LABEL,UUID,MODEL,ROTA,TRAN")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("lsblk: %w", err)
	}

	var parsed lsblkOutput
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, fmt.Errorf("parse lsblk: %w", err)
	}

	var result []BlockDevice
	for _, dev := range parsed.BlockDevices {
		if dev.Type == "loop" || dev.Type == "rom" {
			continue
		}
		bd := convertDevice(dev, roots)
		result = append(result, bd)
	}

	return result, nil
}

func convertDevice(d lsblkDevice, roots []security.Root) BlockDevice {
	bd := BlockDevice{
		Name:       d.Name,
		Size:       d.Size,
		Type:       d.Type,
		Rotational: d.Rota,
	}

	if d.Model != nil {
		bd.Model = strings.TrimSpace(*d.Model)
	}
	if d.Tran != nil {
		bd.Transport = *d.Tran
	}

	for _, child := range d.Children {
		part := convertPartition(child, roots)
		bd.Partitions = append(bd.Partitions, part)
	}

	return bd
}

func convertPartition(d lsblkDevice, roots []security.Root) BlockDevice {
	pd := BlockDevice{
		Name:       d.Name,
		Size:       d.Size,
		Type:       d.Type,
		Rotational: d.Rota,
	}

	if d.MountPoint != nil {
		pd.MountPoint = *d.MountPoint
		if publicPath, root, ok := publicPathForMountPoint(pd.MountPoint, roots); ok {
			pd.VolumPath = publicPath
			pd.Label = root.Label
			if total, free, used, err := diskUsage(pd.MountPoint); err == nil {
				pd.TotalBytes = total
				pd.FreeBytes = free
				pd.UsedBytes = used
			}
			if root.FSType != "" {
				pd.FSType = root.FSType
			}
		}
	}
	if d.FSType != nil {
		pd.FSType = *d.FSType
	}
	if d.Label != nil {
		pd.Label = *d.Label
	}
	if d.UUID != nil {
		pd.UUID = *d.UUID
	}

	return pd
}

func publicPathForMountPoint(mountPoint string, roots []security.Root) (string, security.Root, bool) {
	if strings.TrimSpace(mountPoint) == "" {
		return "", security.Root{}, false
	}
	internalPath, err := filepath.Abs(mountPoint)
	if err != nil {
		return "", security.Root{}, false
	}
	internalPath = filepath.Clean(internalPath)

	var best *security.Root
	for _, root := range roots {
		if !security.PathInside(root.InternalPath, internalPath) {
			continue
		}
		if best == nil || len(root.InternalPath) > len(best.InternalPath) {
			item := root
			best = &item
		}
	}
	if best == nil {
		return "", security.Root{}, false
	}

	rel, err := filepath.Rel(best.InternalPath, internalPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", security.Root{}, false
	}
	if rel == "." {
		return best.Path, *best, true
	}
	return filepath.Join(best.Path, rel), *best, true
}

func diskUsage(path string) (int64, int64, int64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0, 0, err
	}
	blockSize := uint64(stat.Bsize)
	total := int64(min(stat.Blocks*blockSize, uint64(1<<63-1)))
	free := int64(min(stat.Bavail*blockSize, uint64(1<<63-1)))
	used := max(total-free, 0)
	return total, free, used, nil
}
