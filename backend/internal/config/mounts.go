package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/volum-app/volum/backend/internal/security"
)

type mountInfo struct {
	mountPoint string
	fsType     string
	source     string
}

func discoverMountRoots(hostRoot string) ([]security.Root, error) {
	mountInfo := "/proc/self/mountinfo"
	if strings.TrimSpace(hostRoot) != "" {
		mountInfo = filepath.Join(hostRoot, "proc/self/mountinfo")
	}
	file, err := os.Open(mountInfo)
	if err != nil {
		return nil, fmt.Errorf("read mount info: %w", err)
	}
	defer file.Close()

	hr := ""
	if strings.TrimSpace(hostRoot) != "" {
		hr = filepath.Clean(hostRoot)
	}

	roots := make([]security.Root, 0)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		mount, ok := parseMountInfoLine(scanner.Text())
		if !ok || !realFilesystem(mount.fsType) {
			continue
		}

		var statPath string
		var publicPath string
		if hr != "" && hr != "/" && strings.HasPrefix(mount.mountPoint, hr+"/") {
			statPath = mount.mountPoint
			publicPath = filepath.Join("/", strings.TrimPrefix(mount.mountPoint, hr))
		} else {
			statPath = mount.mountPoint
			if hr != "" && hr != "/" {
				if mount.mountPoint == "/" {
					statPath = hr
				} else {
					statPath = filepath.Join(hr, strings.TrimPrefix(mount.mountPoint, string(filepath.Separator)))
				}
			}
			publicPath = mount.mountPoint
		}
		if excludedMountPath(publicPath) {
			continue
		}
		if info, err := os.Stat(statPath); err != nil || !info.IsDir() {
			continue
		}
		if hr != "" && hr != "/" && strings.HasPrefix(mount.mountPoint, hr+"/") {
			label := filepath.Base(publicPath)
			roots = append(roots, security.Root{
				Path:         publicPath,
				InternalPath: mount.mountPoint,
				Label:        label,
				Source:       mount.source,
				FSType:       mount.fsType,
				Discovered:   true,
			})
		} else {
			label := filepath.Base(mount.mountPoint)
			if mount.mountPoint == "/" {
				label = "Server root"
			}
			roots = append(roots, rootSpec(mount.mountPoint, hostRoot, label, mount.source, mount.fsType, true))
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return roots, nil
}

func parseMountInfoLine(line string) (mountInfo, bool) {
	fields := strings.Fields(line)
	separator := -1
	for i, field := range fields {
		if field == "-" {
			separator = i
			break
		}
	}
	if separator < 0 || separator+2 >= len(fields) || len(fields) < 5 {
		return mountInfo{}, false
	}
	return mountInfo{
		mountPoint: unescapeMountPath(fields[4]),
		fsType:     fields[separator+1],
		source:     fields[separator+2],
	}, true
}

func unescapeMountPath(value string) string {
	replacer := strings.NewReplacer(`\040`, " ", `\011`, "\t", `\012`, "\n", `\134`, `\`)
	return replacer.Replace(value)
}

func rootSpec(publicPath, hostRoot, label, source, fsType string, discovered bool) security.Root {
	publicPath, _ = security.CleanAbs(publicPath)
	internalPath := publicPath
	if strings.TrimSpace(hostRoot) != "" {
		hostRoot, _ = security.CleanAbs(hostRoot)
		if publicPath == "/" {
			internalPath = hostRoot
		} else {
			internalPath = filepath.Join(hostRoot, strings.TrimPrefix(publicPath, string(filepath.Separator)))
		}
	}
	return security.Root{
		Path:         publicPath,
		InternalPath: internalPath,
		Label:        label,
		Source:       source,
		FSType:       fsType,
		Discovered:   discovered,
	}
}

func dedupeRoots(roots []security.Root) []security.Root {
	seen := map[string]bool{}
	out := make([]security.Root, 0, len(roots))
	for _, root := range roots {
		if seen[root.Path] {
			continue
		}
		seen[root.Path] = true
		out = append(out, root)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Path == "/" {
			return true
		}
		if out[j].Path == "/" {
			return false
		}
		return out[i].Path < out[j].Path
	})
	return out
}

func realFilesystem(fsType string) bool {
	switch fsType {
	case "ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "ntfs", "ntfs3", "exfat", "vfat", "fuse", "fuseblk", "nfs", "nfs4", "cifs":
		return true
	default:
		return false
	}
}

func excludedMountPath(path string) bool {
	if path == "" {
		return true
	}
	excluded := []string{"/proc", "/sys", "/dev", "/run", "/tmp", "/var/lib/docker", "/var/lib/containerd", "/snap"}
	for _, prefix := range excluded {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}
	return false
}
