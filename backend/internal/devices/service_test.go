package devices

import (
	"testing"

	"github.com/volum-app/volum/backend/internal/security"
)

func TestPublicPathForMountPointUsesConfiguredInternalRoots(t *testing.T) {
	roots := []security.Root{
		{
			Path:         "/",
			InternalPath: "/root",
			Label:        "Server root",
		},
		{
			Path:         "/data",
			InternalPath: "/root/data",
			Label:        "Data",
		},
	}

	publicPath, root, ok := publicPathForMountPoint("/root/data/projects", roots)
	if !ok {
		t.Fatal("expected mount point to resolve")
	}
	if publicPath != "/data/projects" {
		t.Fatalf("unexpected public path: %q", publicPath)
	}
	if root.Path != "/data" {
		t.Fatalf("unexpected root: %#v", root)
	}
}

func TestPublicPathForMountPointFallsBackToRoot(t *testing.T) {
	roots := []security.Root{{
		Path:         "/",
		InternalPath: "/mnt/volum-root",
		Label:        "Server root",
	}}

	publicPath, root, ok := publicPathForMountPoint("/mnt/volum-root", roots)
	if !ok {
		t.Fatal("expected root mount point to resolve")
	}
	if publicPath != "/" {
		t.Fatalf("unexpected public path: %q", publicPath)
	}
	if root.Path != "/" {
		t.Fatalf("unexpected root: %#v", root)
	}
}
