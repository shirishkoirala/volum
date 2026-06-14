package desktop

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/storage"
)

func newTestStore(t *testing.T) (*Store, context.Context) {
	t.Helper()
	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db), context.Background()
}

func TestServiceHealthURLRoundTrip(t *testing.T) {
	store, ctx := newTestStore(t)

	created, err := store.CreateService(ctx, "Jellyfin", "https://jellyfin.example.com", "https://example.com/icon.svg", "https://jellyfin.example.com/health")
	if err != nil {
		t.Fatal(err)
	}
	if created.HealthURL != "https://jellyfin.example.com/health" {
		t.Fatalf("expected created health URL to round trip, got %q", created.HealthURL)
	}

	services, err := store.ListServices(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(services) != 1 {
		t.Fatalf("expected 1 service, got %d", len(services))
	}
	if services[0].HealthURL != "https://jellyfin.example.com/health" {
		t.Fatalf("expected listed health URL to round trip, got %q", services[0].HealthURL)
	}

	updated, err := store.UpdateService(ctx, created.ID, "Jellyfin", "https://jellyfin.example.com", "https://example.com/icon.svg", "https://jellyfin.example.com/status")
	if err != nil {
		t.Fatal(err)
	}
	if updated.HealthURL != "https://jellyfin.example.com/status" {
		t.Fatalf("expected updated health URL to round trip, got %q", updated.HealthURL)
	}
}
