package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewDisabled(t *testing.T) {
	s, err := New("", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if s.Enabled() {
		t.Fatal("expected disabled service")
	}
}

func TestNewEnabled(t *testing.T) {
	s, err := New("admin", "readonly", "secret")
	if err != nil {
		t.Fatal(err)
	}
	if !s.Enabled() {
		t.Fatal("expected enabled service")
	}
}

func TestNewGeneratesSecret(t *testing.T) {
	s, err := New("admin", "readonly", "")
	if err != nil {
		t.Fatal(err)
	}
	if !s.Enabled() || s.secret == nil || len(s.secret) != 32 {
		t.Fatal("expected generated secret")
	}
}

func TestLoginAdmin(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	token, user, ok := s.Login(RoleAdmin, "admin")
	if !ok {
		t.Fatal("expected login ok")
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
}

func TestLoginReadonly(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	_, user, ok := s.Login(RoleReadonly, "readonly")
	if !ok {
		t.Fatal("expected login ok")
	}
	if user.Role != RoleReadonly {
		t.Fatalf("expected readonly role, got %s", user.Role)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	_, _, ok := s.Login(RoleAdmin, "wrong")
	if ok {
		t.Fatal("expected login to fail")
	}
}

func TestLoginDisabledReturnsAdmin(t *testing.T) {
	s, _ := New("", "", "")
	token, user, ok := s.Login(RoleAdmin, "")
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
	s, _ := New("admin", "readonly", "secret")
	token, _, _ := s.Login(RoleAdmin, "admin")

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "volum_session", Value: token})

	user, ok := s.UserFromRequest(r)
	if !ok {
		t.Fatal("expected user from request")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
}

func TestUserFromRequestWithNoCookie(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	_, ok := s.UserFromRequest(r)
	if ok {
		t.Fatal("expected no user without cookie")
	}
}

func TestUserFromRequestWithInvalidCookie(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "volum_session", Value: "invalid-token"})
	_, ok := s.UserFromRequest(r)
	if ok {
		t.Fatal("expected no user for invalid token")
	}
}

func TestUserFromRequestDisabled(t *testing.T) {
	s, _ := New("", "", "")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	user, ok := s.UserFromRequest(r)
	if !ok {
		t.Fatal("expected user for disabled auth")
	}
	if user.Role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", user.Role)
	}
}

func TestVerifyRoundTrip(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	token, _, _ := s.Login(RoleAdmin, "admin")
	role, ok := s.verify(token)
	if !ok || role != RoleAdmin {
		t.Fatal("verify round-trip failed")
	}
}

func TestVerifyTamperedToken(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	token, _, _ := s.Login(RoleAdmin, "admin")
	tampered := token + "x"
	_, ok := s.verify(tampered)
	if ok {
		t.Fatal("expected verify to reject tampered token")
	}
}

func TestUserContextRoundTrip(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	user := User{Role: RoleReadonly}
	ctx := context.Background()
	ctx = s.WithUser(ctx, user)
	got, ok := UserFromContext(ctx)
	if !ok {
		t.Fatal("expected user from context")
	}
	if got.Role != RoleReadonly {
		t.Fatalf("expected readonly role, got %s", got.Role)
	}
}

func TestVerifyInvalidFormat(t *testing.T) {
	s, _ := New("admin", "readonly", "secret")
	_, ok := s.verify("no-dot-separator")
	if ok {
		t.Fatal("expected verify to reject invalid format")
	}
	_, ok = s.verify("base64.payload.invalid.signature")
	if ok {
		t.Fatal("expected verify to reject triple-dot format")
	}
}
