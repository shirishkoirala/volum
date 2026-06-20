package config

import (
	"testing"

	"github.com/volum-app/volum/backend/internal/security"
)

func TestParseMountInfoLine(t *testing.T) {
	line := "36 25 8:1 / /mnt/media rw,relatime shared:1 - ext4 /dev/sdb1 rw"
	mount, ok := parseMountInfoLine(line)
	if !ok {
		t.Fatal("expected mount info to parse")
	}
	if mount.mountPoint != "/mnt/media" || mount.fsType != "ext4" || mount.source != "/dev/sdb1" {
		t.Fatalf("unexpected mount info: %#v", mount)
	}
}

func TestParseMountInfoLineUnescapesSpaces(t *testing.T) {
	line := "36 25 8:1 / /mnt/My\\040Drive rw,relatime shared:1 - exfat /dev/sdb1 rw"
	mount, ok := parseMountInfoLine(line)
	if !ok {
		t.Fatal("expected mount info to parse")
	}
	if mount.mountPoint != "/mnt/My Drive" {
		t.Fatalf("expected unescaped mount path, got %q", mount.mountPoint)
	}
}

func TestRealFilesystemFilter(t *testing.T) {
	if !realFilesystem("ext4") || !realFilesystem("nfs4") || !realFilesystem("cifs") {
		t.Fatal("expected common storage filesystems to be included")
	}
	if realFilesystem("proc") || realFilesystem("tmpfs") || realFilesystem("overlay") {
		t.Fatal("expected pseudo filesystems to be excluded")
	}
}

func TestLoadRootsMergesDiscoveredAndExplicit(t *testing.T) {
	roots, err := loadRoots("/data,/mnt/media", "", true, false, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 3 {
		t.Fatalf("expected root plus two explicit roots, got %#v", roots)
	}
	if roots[0].Path != "/" {
		t.Fatalf("expected / first, got %#v", roots)
	}
}

func TestParseBool(t *testing.T) {
	cases := []struct {
		input string
		want  bool
	}{
		{"1", true},
		{"true", true},
		{"True", true},
		{"TRUE", true},
		{"yes", true},
		{"Yes", true},
		{"on", true},
		{"On", true},
		{"", false},
		{"0", false},
		{"false", false},
		{"no", false},
		{"off", false},
		{"random", false},
	}
	for _, tc := range cases {
		got := parseBool(tc.input)
		if got != tc.want {
			t.Errorf("parseBool(%q) = %v, want %v", tc.input, got, tc.want)
		}
	}
}

func TestParseRoots(t *testing.T) {
	roots, err := parseRoots("/data,/mnt/media", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 2 {
		t.Fatalf("expected 2 roots, got %d", len(roots))
	}
	if roots[0].Path != "/data" || roots[1].Path != "/mnt/media" {
		t.Errorf("unexpected roots: %#v", roots)
	}
}

func TestParseRootsEmpty(t *testing.T) {
	roots, err := parseRoots("", "")
	if err != nil {
		t.Fatal(err)
	}
	if roots != nil {
		t.Fatalf("expected nil, got %#v", roots)
	}
}

func TestParseRootsSkipsEmptyEntries(t *testing.T) {
	roots, err := parseRoots("/data,,/media,", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 2 {
		t.Fatalf("expected 2 roots, got %d", len(roots))
	}
}

func TestDedupeRoots(t *testing.T) {
	roots := []security.Root{
		{Path: "/media"},
		{Path: "/data"},
		{Path: "/media"},
		{Path: "/"},
	}
	result := dedupeRoots(roots)
	if len(result) != 3 {
		t.Fatalf("expected 3 roots, got %d", len(result))
	}
	if result[0].Path != "/" {
		t.Errorf("expected / first, got %s", result[0].Path)
	}
}

func TestExcludedMountPath(t *testing.T) {
	cases := []struct {
		path     string
		excluded bool
	}{
		{"", true},
		{"/proc", true},
		{"/proc/1", true},
		{"/sys", true},
		{"/sys/class", true},
		{"/dev", true},
		{"/run", true},
		{"/tmp", true},
		{"/var/lib/docker", true},
		{"/var/lib/docker/containers", true},
		{"/var/lib/containerd", true},
		{"/snap", true},
		{"/snap/core", true},
		{"/home", false},
		{"/mnt/data", false},
		{"/var/log", false},
		{"/usr", false},
	}
	for _, tc := range cases {
		got := excludedMountPath(tc.path)
		if got != tc.excluded {
			t.Errorf("excludedMountPath(%q) = %v, want %v", tc.path, got, tc.excluded)
		}
	}
}

func TestRootSpec(t *testing.T) {
	r := rootSpec("/data", "", "Data", "/dev/sda1", "ext4", true)
	if r.Path != "/data" || r.Label != "Data" || r.Source != "/dev/sda1" || r.FSType != "ext4" || !r.Discovered {
		t.Errorf("unexpected root: %#v", r)
	}
	if r.InternalPath != "/data" {
		t.Errorf("expected internalPath /data, got %s", r.InternalPath)
	}
}

func TestRootSpecWithHostRoot(t *testing.T) {
	r := rootSpec("/mnt/data", "/host", "Data", "/dev/sda1", "ext4", false)
	if r.Path != "/mnt/data" {
		t.Errorf("expected /mnt/data, got %s", r.Path)
	}
	if r.InternalPath != "/host/mnt/data" {
		t.Errorf("expected /host/mnt/data, got %s", r.InternalPath)
	}
}

func TestRootSpecRootWithHostRoot(t *testing.T) {
	r := rootSpec("/", "/opt/host", "Server root", "", "", false)
	if r.InternalPath != "/opt/host" {
		t.Errorf("expected /opt/host, got %s", r.InternalPath)
	}
}

func TestLoadRequiresSessionSecretWhenAuthRequired(t *testing.T) {
	t.Setenv("VOLUM_ROOTS", "/tmp")
	t.Setenv("VOLUM_AUTH_REQUIRED", "true")
	t.Setenv("VOLUM_SESSION_SECRET", "")

	if _, err := Load(); err == nil {
		t.Fatal("expected auth-required config to reject missing session secret")
	}

	t.Setenv("VOLUM_SESSION_SECRET", "session-secret-012345678901234567890123456")
	if _, err := Load(); err != nil {
		t.Fatalf("expected auth-required config to load, got %v", err)
	}
}

func TestLoadRejectsDiscoveryWithoutAuthentication(t *testing.T) {
	t.Setenv("VOLUM_ROOTS", t.TempDir())
	t.Setenv("VOLUM_DISCOVER_ROOTS", "true")
	t.Setenv("VOLUM_INCLUDE_ROOT", "false")
	t.Setenv("VOLUM_AUTH_REQUIRED", "false")
	if _, err := Load(); err == nil {
		t.Fatal("expected discovered roots without authentication to be rejected")
	}
}
