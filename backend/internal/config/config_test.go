package config

import "testing"

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

func TestLoadRequiresSessionSecretWhenAuthRequired(t *testing.T) {
	t.Setenv("VOLUM_ROOTS", "/tmp")
	t.Setenv("VOLUM_AUTH_REQUIRED", "true")
	t.Setenv("VOLUM_SESSION_SECRET", "")

	if _, err := Load(); err == nil {
		t.Fatal("expected auth-required config to reject missing session secret")
	}

	t.Setenv("VOLUM_SESSION_SECRET", "session-secret")
	if _, err := Load(); err != nil {
		t.Fatalf("expected auth-required config to load, got %v", err)
	}
}
