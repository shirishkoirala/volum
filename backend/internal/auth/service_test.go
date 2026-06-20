package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/volum-app/volum/backend/internal/storage"
)

func setupStore(t *testing.T) (*Store, context.Context) {
	t.Helper()
	ctx := context.Background()
	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db), ctx
}

func TestNewDisabled(t *testing.T) {
	s, err := New(nil, "")
	if err != nil {
		t.Fatal(err)
	}
	if s.Enabled() {
		t.Fatal("expected disabled service")
	}
}

func TestNewEnabled(t *testing.T) {
	store, _ := setupStore(t)
	s, err := New(store, "secret")
	if err != nil {
		t.Fatal(err)
	}
	if !s.Enabled() {
		t.Fatal("expected enabled service")
	}
}

func TestNewGeneratesSecret(t *testing.T) {
	store, _ := setupStore(t)
	s, err := New(store, "")
	if err != nil {
		t.Fatal(err)
	}
	if !s.Enabled() || len(s.secret) != 32 {
		t.Fatal("expected generated secret")
	}
}

func TestLoginAndVerify(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")

	_, _ = store.CreateUser(ctx, "admin", "adminpass123456", RoleAdmin)
	_, _ = store.CreateUser(ctx, "reader", "readerpass123456", RoleReadonly)

	token, user, ok := s.Login(ctx, "admin", "adminpass123456", false)
	if !ok {
		t.Fatal("expected login ok")
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
	if user.Username != "admin" {
		t.Fatalf("expected username admin, got %s", user.Username)
	}
	if user.ID == "" {
		t.Fatal("expected non-empty user ID")
	}

	claims, ok := s.verify(token)
	if !ok || claims.role != RoleAdmin || claims.userID != user.ID {
		t.Fatal("verify round-trip failed")
	}
}

func TestLoginReadonly(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _ = store.CreateUser(ctx, "reader", "readerpass", RoleReadonly)

	_, user, ok := s.Login(ctx, "reader", "readerpass", false)
	if !ok {
		t.Fatal("expected login ok")
	}
	if user.Role != RoleReadonly {
		t.Fatalf("expected readonly role, got %s", user.Role)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _ = store.CreateUser(ctx, "admin", "adminpass", RoleAdmin)

	_, _, ok := s.Login(ctx, "admin", "wrong", false)
	if ok {
		t.Fatal("expected login to fail")
	}
}

func TestLoginNonExistentUser(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _, ok := s.Login(ctx, "nobody", "anything", false)
	if ok {
		t.Fatal("expected login to fail for unknown user")
	}
}

func TestLoginDisabledReturnsAdmin(t *testing.T) {
	s, _ := New(nil, "")
	token, user, ok := s.Login(context.Background(), "", "", false)
	if !ok {
		t.Fatal("expected login ok for disabled auth")
	}
	if token != "" {
		t.Fatal("expected empty token for disabled auth")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
}

func TestUserFromRequestWithValidCookie(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _ = store.CreateUser(ctx, "admin", "adminpass", RoleAdmin)
	token, _, _ := s.Login(ctx, "admin", "adminpass", false)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "volum_session", Value: token})

	user, ok := s.UserFromRequest(r)
	if !ok {
		t.Fatal("expected user from request")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
	if user.Username != "admin" {
		t.Fatalf("expected username admin, got %s", user.Username)
	}
}

func TestUserFromRequestWithNoCookie(t *testing.T) {
	store, _ := setupStore(t)
	s, _ := New(store, "secret")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	_, ok := s.UserFromRequest(r)
	if ok {
		t.Fatal("expected no user without cookie")
	}
}

func TestUserFromRequestWithInvalidCookie(t *testing.T) {
	store, _ := setupStore(t)
	s, _ := New(store, "secret")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "volum_session", Value: "invalid-token"})
	_, ok := s.UserFromRequest(r)
	if ok {
		t.Fatal("expected no user for invalid token")
	}
}

func TestUserFromRequestDisabled(t *testing.T) {
	s, _ := New(nil, "")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	user, ok := s.UserFromRequest(r)
	if !ok {
		t.Fatal("expected user for disabled auth")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
}

func TestVerifyTamperedToken(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _ = store.CreateUser(ctx, "admin", "adminpass", RoleAdmin)
	token, _, _ := s.Login(ctx, "admin", "adminpass", false)
	tampered := token + "x"
	_, ok := s.verify(tampered)
	if ok {
		t.Fatal("expected verify to reject tampered token")
	}
}

func TestVerifyInvalidFormat(t *testing.T) {
	store, _ := setupStore(t)
	s, _ := New(store, "secret")
	_, ok := s.verify("no-dot-separator")
	if ok {
		t.Fatal("expected verify to reject invalid format")
	}
	ok = false
	_, ok = s.verify("base64.payload.invalid.signature")
	if ok {
		t.Fatal("expected verify to reject triple-dot format")
	}
}

func TestUserContextRoundTrip(t *testing.T) {
	s, _ := New(nil, "")
	user := User{ID: "u1", Username: "admin", Role: RoleAdmin}
	ctx := context.Background()
	ctx = s.WithUser(ctx, user)
	got, ok := UserFromContext(ctx)
	if !ok {
		t.Fatal("expected user from context")
	}
	if got.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", got.Role)
	}
	if got.Username != "admin" {
		t.Fatalf("expected username admin, got %s", got.Username)
	}
}

func TestTokenEncodesUserID(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _ = store.CreateUser(ctx, "admin", "adminpass", RoleAdmin)
	token, user, ok := s.Login(ctx, "admin", "adminpass", false)
	if !ok {
		t.Fatal("expected login ok")
	}

	claims, ok := s.verify(token)
	if !ok {
		t.Fatal("expected verify ok")
	}
	if claims.userID != user.ID {
		t.Fatalf("expected userID %s, got %s", user.ID, claims.userID)
	}
	if claims.role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", claims.role)
	}
}

func TestSetupRequiredWhenNoUsers(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	req, err := s.SetupRequired(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !req {
		t.Fatal("expected setup required for empty store")
	}
}

func TestSetupRequiredWhenUsersExist(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	_, _ = store.CreateUser(ctx, "admin", "adminpass", RoleAdmin)
	req, err := s.SetupRequired(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if req {
		t.Fatal("expected no setup required when users exist")
	}
}

func TestSetupRequiredDisabled(t *testing.T) {
	s, _ := New(nil, "")
	req, err := s.SetupRequired(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if req {
		t.Fatal("expected no setup required when auth disabled")
	}
}

func TestCreateInitialAdminOnlyOnce(t *testing.T) {
	store, ctx := setupStore(t)
	created, err := store.CreateInitialAdmin(ctx, "admin", "admin-password")
	if err != nil {
		t.Fatal(err)
	}
	if created.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", created.Role)
	}
	if _, err := store.CreateInitialAdmin(ctx, "second", "second-password"); !errors.Is(err, ErrSetupComplete) {
		t.Fatalf("expected setup complete error, got %v", err)
	}
}

func TestUserFromRequestDeletedUser(t *testing.T) {
	store, ctx := setupStore(t)
	s, _ := New(store, "secret")
	record, _ := store.CreateUser(ctx, "admin", "adminpass", RoleAdmin)
	token, _, _ := s.Login(ctx, "admin", "adminpass", false)

	_ = store.DeleteUser(ctx, record.ID)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "volum_session", Value: token})
	_, ok := s.UserFromRequest(r)
	if ok {
		t.Fatal("expected no user after deletion")
	}
}

func TestFileStore(t *testing.T) {
	db, err := storage.Open(filepath.Join(t.TempDir(), "volum.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := NewStore(db)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "alice", "pass", RoleAdmin); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CreateUser(ctx, "bob", "pass2", RoleReadonly); err != nil {
		t.Fatal(err)
	}

	n, err := store.Count(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("expected 2 users, got %d", n)
	}

	u, err := store.GetByUsername(ctx, "alice")
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "alice" || u.Role != RoleAdmin {
		t.Fatal("unexpected user data")
	}
	if !store.VerifyPassword(u, "pass") {
		t.Fatal("password verification failed")
	}
	if store.VerifyPassword(u, "wrong") {
		t.Fatal("wrong password should fail")
	}

	if err := store.UpdatePassword(ctx, u.ID, "newpass"); err != nil {
		t.Fatal(err)
	}
	u2, _ := store.GetByID(ctx, u.ID)
	if !store.VerifyPassword(u2, "newpass") {
		t.Fatal("password update verification failed")
	}

	if err := store.UpdateRole(ctx, u.ID, RoleReadonly); err != nil {
		t.Fatal(err)
	}
	u3, _ := store.GetByID(ctx, u.ID)
	if u3.Role != RoleReadonly {
		t.Fatal("role update failed")
	}

	users, err := store.ListUsers(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}
}
