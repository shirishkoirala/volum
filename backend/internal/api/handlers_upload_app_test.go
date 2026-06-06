package api

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestFinalizeAppBundleArchiveWithRootAppDirectory(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	archivePath := filepath.Join(ts.root, "Nextcloud.app.zip")
	writeTestZip(t, archivePath, map[string]string{
		"Nextcloud.app/Contents/Info.plist":      "plist",
		"Nextcloud.app/Contents/MacOS/Nextcloud": "binary",
	})

	result, converted, err := ts.finalizeAppBundleArchive(archivePath, "Nextcloud.app.zip", "rename")
	if err != nil {
		t.Fatal(err)
	}
	if !converted {
		t.Fatal("expected app bundle archive to be converted")
	}
	if result.filename != "Nextcloud.app" {
		t.Fatalf("expected filename Nextcloud.app, got %s", result.filename)
	}
	if result.path != filepath.Join(ts.root, "Nextcloud.app") {
		t.Fatalf("expected app path under test root, got %s", result.path)
	}
	assertFileContent(t, filepath.Join(ts.root, "Nextcloud.app", "Contents", "Info.plist"), "plist")
	assertFileContent(t, filepath.Join(ts.root, "Nextcloud.app", "Contents", "MacOS", "Nextcloud"), "binary")
	if _, err := os.Stat(archivePath); !os.IsNotExist(err) {
		t.Fatalf("expected source archive to be removed, got %v", err)
	}
}

func TestFinalizeAppBundleArchiveWithContentsAtArchiveRoot(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	archivePath := filepath.Join(ts.root, "Example.app.zip")
	writeTestZip(t, archivePath, map[string]string{
		"Contents/Info.plist": "plist",
	})

	result, converted, err := ts.finalizeAppBundleArchive(archivePath, "Example.app.zip", "rename")
	if err != nil {
		t.Fatal(err)
	}
	if !converted {
		t.Fatal("expected app bundle archive to be converted")
	}
	if result.filename != "Example.app" {
		t.Fatalf("expected filename Example.app, got %s", result.filename)
	}
	assertFileContent(t, filepath.Join(ts.root, "Example.app", "Contents", "Info.plist"), "plist")
}

func writeTestZip(t *testing.T, path string, files map[string]string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(f)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}

func assertFileContent(t *testing.T, path, want string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != want {
		t.Fatalf("expected %q in %s, got %q", want, path, string(data))
	}
}
