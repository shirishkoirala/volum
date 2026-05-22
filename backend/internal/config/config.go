package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/volum-app/volum/backend/internal/security"
)

type Config struct {
	Roots            []security.Root
	DB               string
	Port             string
	AdminPassword    string
	ReadonlyPassword string
	SessionSecret    string
	AuthRequired     bool
	HostRoot         string
	PublicURL        string
}

func Load() (Config, error) {
	hostRoot := strings.TrimSpace(os.Getenv("VOLUM_HOST_ROOT"))
	includeRoot := parseBool(os.Getenv("VOLUM_INCLUDE_ROOT"))
	discoverRoots := parseBool(os.Getenv("VOLUM_DISCOVER_ROOTS"))

	roots, err := loadRoots(os.Getenv("VOLUM_ROOTS"), hostRoot, includeRoot, discoverRoots)
	if err != nil {
		return Config{}, err
	}

	db := os.Getenv("VOLUM_DB")
	if db == "" {
		db = "./volum.db"
	}

	port := os.Getenv("VOLUM_PORT")
	if port == "" {
		port = "8090"
	}
	if _, err := strconv.Atoi(port); err != nil {
		return Config{}, errors.New("VOLUM_PORT must be a number")
	}

	cfg := Config{
		Roots:            roots,
		DB:               db,
		Port:             port,
		AdminPassword:    os.Getenv("VOLUM_ADMIN_PASSWORD"),
		ReadonlyPassword: os.Getenv("VOLUM_READONLY_PASSWORD"),
		SessionSecret:    os.Getenv("VOLUM_SESSION_SECRET"),
		AuthRequired:     parseBool(os.Getenv("VOLUM_AUTH_REQUIRED")),
		HostRoot:         hostRoot,
		PublicURL:        os.Getenv("VOLUM_PUBLIC_URL"),
	}
	if cfg.AuthRequired {
		if strings.TrimSpace(cfg.AdminPassword) == "" {
			return Config{}, errors.New("VOLUM_ADMIN_PASSWORD is required when VOLUM_AUTH_REQUIRED=true")
		}
		if strings.TrimSpace(cfg.SessionSecret) == "" {
			return Config{}, errors.New("VOLUM_SESSION_SECRET is required when VOLUM_AUTH_REQUIRED=true")
		}
	}
	return cfg, nil
}

func loadRoots(value, hostRoot string, includeRoot, discoverRoots bool) ([]security.Root, error) {
	roots := make([]security.Root, 0)
	if includeRoot {
		roots = append(roots, rootSpec("/", hostRoot, "Server root", "", "", true))
	}
	if discoverRoots {
		discovered, err := discoverMountRoots(hostRoot)
		if err != nil {
			return nil, err
		}
		roots = append(roots, discovered...)
	}
	explicit, err := parseRoots(value, hostRoot)
	if err != nil {
		return nil, err
	}
	roots = append(roots, explicit...)
	roots = dedupeRoots(roots)
	if len(roots) == 0 {
		return nil, errors.New("no roots configured; set VOLUM_ROOTS or enable VOLUM_INCLUDE_ROOT/VOLUM_DISCOVER_ROOTS")
	}
	return roots, nil
}

func parseRoots(value, hostRoot string) ([]security.Root, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}

	raw := strings.Split(value, ",")
	roots := make([]security.Root, 0, len(raw))
	for _, root := range raw {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		publicPath, err := cleanAbs(root)
		if err != nil {
			return nil, err
		}
		roots = append(roots, rootSpec(publicPath, hostRoot, "", "", "", false))
	}
	return roots, nil
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

	roots := make([]security.Root, 0)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		mount, ok := parseMountInfoLine(scanner.Text())
		if !ok || !realFilesystem(mount.fsType) {
			continue
		}
		if excludedMountPath(mount.mountPoint) {
			continue
		}
		mountPath := mount.mountPoint
		if strings.TrimSpace(hostRoot) != "" {
			if mount.mountPoint == "/" {
				mountPath = hostRoot
			} else {
				mountPath = filepath.Join(hostRoot, strings.TrimPrefix(mount.mountPoint, string(filepath.Separator)))
			}
		}
		if info, err := os.Stat(mountPath); err != nil || !info.IsDir() {
			continue
		}
		label := filepath.Base(mount.mountPoint)
		if mount.mountPoint == "/" {
			label = "Server root"
		}
		roots = append(roots, rootSpec(mount.mountPoint, hostRoot, label, mount.source, mount.fsType, true))
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return roots, nil
}

type mountInfo struct {
	mountPoint string
	fsType     string
	source     string
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
	publicPath, _ = cleanAbs(publicPath)
	internalPath := publicPath
	if strings.TrimSpace(hostRoot) != "" {
		hostRoot, _ = cleanAbs(hostRoot)
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

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func cleanAbs(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}
