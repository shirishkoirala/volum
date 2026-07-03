package shares

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestVerifyLegacyPasswordUpgradesHash(t *testing.T) {
	s := setupStore(t)
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	legacy := sha256.Sum256([]byte("legacy-password"))
	legacyHash := hex.EncodeToString(legacy[:])
	if _, err := s.db.Exec(`UPDATE shares SET password_hash = ? WHERE id = ?`, legacyHash, created.ID); err != nil {
		t.Fatal(err)
	}
	created.PasswordHash = legacyHash

	if !s.VerifyPassword(created, "legacy-password") {
		t.Fatal("expected legacy password to verify")
	}
	upgraded, err := s.GetByToken(created.Token)
	if err != nil {
		t.Fatal(err)
	}
	if upgraded == nil || upgraded.PasswordHash == legacyHash {
		t.Fatal("expected legacy password hash to be upgraded")
	}
	if !s.VerifyPassword(upgraded, "legacy-password") {
		t.Fatal("expected upgraded password to verify")
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

func TestReserveDownload(t *testing.T) {
	s := setupStore(t)
	maxDownloads := 2
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs", MaxDownloads: &maxDownloads}, "admin")
	if err != nil {
		t.Fatal(err)
	}

	ok, err := s.ReserveDownload(created.ID, now())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected increment to succeed")
	}

	got, _ := s.GetByToken(created.Token)
	if got.DownloadCount != 1 {
		t.Fatalf("expected 1 download, got %d", got.DownloadCount)
	}

	ok, err = s.ReserveDownload(created.ID, now())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected second increment to succeed")
	}

	ok, err = s.ReserveDownload(created.ID, now())
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("expected third increment to be rejected")
	}
}

func TestReleaseDownload(t *testing.T) {
	s := setupStore(t)
	maxDownloads := 1
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs", MaxDownloads: &maxDownloads}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	ok, err := s.ReserveDownload(created.ID, now())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected reservation to succeed")
	}
	if err := s.ReleaseDownload(created.ID); err != nil {
		t.Fatal(err)
	}
	got, err := s.GetByToken(created.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got.DownloadCount != 0 {
		t.Fatalf("expected released download count to be 0, got %d", got.DownloadCount)
	}
	ok, err = s.ReserveDownload(created.ID, now())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected reservation after release to succeed")
	}
}

func TestReserveDownloadRejectsExpiredOrDisabledShare(t *testing.T) {
	s := setupStore(t)
	expired := now().Add(-time.Minute).Format(time.RFC3339)
	created, err := s.Create(CreateRequest{Path: "/mnt/data/docs", ExpiresAt: expired}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := s.ReserveDownload(created.ID, now()); err != nil || ok {
		t.Fatalf("expected expired share reservation to fail, ok=%v err=%v", ok, err)
	}

	active, err := s.Create(CreateRequest{Path: "/mnt/data/docs"}, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`UPDATE shares SET enabled = 0 WHERE id = ?`, active.ID); err != nil {
		t.Fatal(err)
	}
	if ok, err := s.ReserveDownload(active.ID, now()); err != nil || ok {
		t.Fatalf("expected disabled share reservation to fail, ok=%v err=%v", ok, err)
	}
}

func TestShareAccessTokenExpires(t *testing.T) {
	share := &Share{Token: strings.Repeat("a", 64), PasswordHash: "$2a$hash"}
	at := now()
	token := AccessToken(share, at.Add(time.Minute))
	if !VerifyAccessToken(share, token, at) {
		t.Fatal("expected access token to verify before expiry")
	}
	if VerifyAccessToken(share, token, at.Add(2*time.Minute)) {
		t.Fatal("expected access token to fail after expiry")
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

	ok, err := s.ReserveDownload(created.ID, now())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected increment to succeed")
	}

	if err := s.Delete(created.ID); err != nil {
		t.Fatal(err)
	}

	shares, _ := s.List()
	if len(shares) != 0 {
		t.Fatal("expected 0 shares after full flow")
	}
}
