package devices

import (
	"encoding/json"
	"fmt"
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

	rootMap := buildRootMap(roots)

	var result []BlockDevice
	for _, dev := range parsed.BlockDevices {
		if dev.Type == "loop" || dev.Type == "rom" {
			continue
		}
		bd := convertDevice(dev, rootMap)
		result = append(result, bd)
	}

	return result, nil
}

func buildRootMap(roots []security.Root) map[string]security.Root {
	m := make(map[string]security.Root, len(roots))
	for _, r := range roots {
		m[r.Path] = r
	}
	return m
}

func convertDevice(d lsblkDevice, rootMap map[string]security.Root) BlockDevice {
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
		part := convertPartition(child, rootMap)
		bd.Partitions = append(bd.Partitions, part)
	}

	return bd
}

func convertPartition(d lsblkDevice, rootMap map[string]security.Root) BlockDevice {
	pd := BlockDevice{
		Name:       d.Name,
		Size:       d.Size,
		Type:       d.Type,
		Rotational: d.Rota,
	}

	if d.MountPoint != nil {
		pd.MountPoint = *d.MountPoint
		publicPath := stripHostPrefix(pd.MountPoint)
		pd.VolumPath = publicPath

		if root, ok := rootMap[publicPath]; ok {
			pd.VolumPath = root.Path
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

func stripHostPrefix(mountPoint string) string {
	if strings.HasPrefix(mountPoint, "/host/") {
		return mountPoint[5:]
	}
	if mountPoint == "/host" {
		return "/"
	}
	return mountPoint
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
