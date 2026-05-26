package shares

import (
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/storage"
)

func setupStore(t *testing.T) *Store {
	t.Helper()
	db, err := storage.Open(filepath.Join(t.TempDir(), "shares.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db)
}

func TestCreateShare(t *testing.T) {
	s := setupStore(t)
	share, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if share.ID == "" {
		t.Fatal("expected non-empty ID")
	}
	if share.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if share.Path != "/mnt/data/docs" {
		t.Fatalf("expected path /mnt/data/docs, got %s", share.Path)
	}
	if !share.Enabled {
		t.Fatal("expected share enabled")
	}
	if share.DownloadCount != 0 {
		t.Fatalf("expected 0 downloads, got %d", share.DownloadCount)
	}
	if share.CreatedBy != "admin" {
		t.Fatalf("expected createdBy admin, got %s", share.CreatedBy)
	}
}

func TestCreateShareWithPassword(t *testing.T) {
	s := setupStore(t)
	maxDownloads := 5
	share, err := s.Create(CreateRequest{
		Path:         "/mnt/data/docs",
		Password:     "secret123",
		ExpiresAt:    "2026-12-31T23:59:59Z",
		MaxDownloads: &maxDownloads,
	}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if share.PasswordHash == "" {
		t.Fatal("expected password hash to be set")
	}
	if share.ExpiresAt == nil || *share.ExpiresAt != "2026-12-31T23:59:59Z" {
		t.Fatal("expected expiresAt to be set")
	}
	if share.MaxDownloads == nil || *share.MaxDownloads != 5 {
		t.Fatal("expected maxDownloads to be 5")
	}
}

func TestListShares(t *testing.T) {
	s := setupStore(t)
	_, err := s.Create(CreateRequest{Path: "/mnt/data/a"}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Create(CreateRequest{Path: "/mnt/data/b"}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	shares, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(shares) != 2 {
		t.Fatalf("expected 2 shares, got %d", len(shares))
	}
}

func TestListSharesEmpty(t *testing.T) {
	s := setupStore(t)
	shares, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(shares) != 0 {
		t.Fatalf("expected empty list, got %d", len(shares))
	}
}

func TestGetByToken(t *testing.T) {
	s := setupStore(t)
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	got, err := s.GetByToken(created.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatal("expected share")
	}
	if got.ID != created.ID {
		t.Fatalf("expected id %s, got %s", created.ID, got.ID)
	}
}

func TestGetByTokenNotFound(t *testing.T) {
	s := setupStore(t)
	got, err := s.GetByToken("nonexistent-token")
	if err != nil {
		t.Fatal(err)
	}
	if got != nil {
		t.Fatal("expected nil for nonexistent token")
	}
}

func TestDeleteShare(t *testing.T) {
	s := setupStore(t)
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	if err := s.Delete(created.ID); err != nil {
		t.Fatal(err)
	}

	shares, _ := s.List()
	if len(shares) != 0 {
		t.Fatal("expected 0 shares after delete")
	}
}

func TestIncrementDownloadCount(t *testing.T) {
	s := setupStore(t)
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	if err := s.IncrementDownloadCount(created.ID); err != nil {
		t.Fatal(err)
	}

	got, _ := s.GetByToken(created.Token)
	if got.DownloadCount != 1 {
		t.Fatalf("expected 1 download, got %d", got.DownloadCount)
	}
}

func TestFullFlow(t *testing.T) {
	s := setupStore(t)

	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	got, err := s.GetByToken(created.Token)
	if err != nil || got == nil {
		t.Fatal("expected to find share by token")
	}

	if err := s.IncrementDownloadCount(created.ID); err != nil {
		t.Fatal(err)
	}

	if err := s.Delete(created.ID); err != nil {
		t.Fatal(err)
	}

	shares, _ := s.List()
	if len(shares) != 0 {
		t.Fatal("expected 0 shares after full flow")
	}
}
