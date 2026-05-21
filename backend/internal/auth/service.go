package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
)

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleReadonly Role = "readonly"
)

type User struct {
	Role Role `json:"role"`
}

type contextKey string

const userKey contextKey = "auth_user"

var ErrUnauthorized = errors.New("authentication required")

type Service struct {
	adminPassword    string
	readonlyPassword string
	secret           []byte
	enabled          bool
}

func New(adminPassword, readonlyPassword, sessionSecret string) (*Service, error) {
	enabled := adminPassword != "" || readonlyPassword != ""
	if !enabled {
		return &Service{}, nil
	}
	if strings.TrimSpace(sessionSecret) == "" {
		generated := make([]byte, 32)
		if _, err := rand.Read(generated); err != nil {
			return nil, err
		}
		return &Service{
			adminPassword:    adminPassword,
			readonlyPassword: readonlyPassword,
			secret:           generated,
			enabled:          true,
		}, nil
	}
	return &Service{
		adminPassword:    adminPassword,
		readonlyPassword: readonlyPassword,
		secret:           []byte(sessionSecret),
		enabled:          true,
	}, nil
}

func (s *Service) Enabled() bool {
	return s.enabled
}

func (s *Service) Login(role Role, password string) (string, User, bool) {
	if !s.enabled {
		return "", User{Role: RoleAdmin}, true
	}
	if role == RoleAdmin && s.adminPassword != "" && password == s.adminPassword {
		return s.sign(role), User{Role: role}, true
	}
	if role == RoleReadonly && s.readonlyPassword != "" && password == s.readonlyPassword {
		return s.sign(role), User{Role: role}, true
	}
	return "", User{}, false
}

func (s *Service) UserFromRequest(r *http.Request) (User, bool) {
	if !s.enabled {
		return User{Role: RoleAdmin}, true
	}
	cookie, err := r.Cookie("volum_session")
	if err != nil {
		return User{}, false
	}
	role, ok := s.verify(cookie.Value)
	if !ok {
		return User{}, false
	}
	return User{Role: role}, true
}

func (s *Service) WithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, userKey, user)
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(userKey).(User)
	return user, ok
}

func (s *Service) sign(role Role) string {
	payload := string(role)
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	signature := mac.Sum(nil)
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func (s *Service) verify(value string) (Role, bool) {
	payload, signature, ok := strings.Cut(value, ".")
	if !ok {
		return "", false
	}
	decodedPayload, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return "", false
	}
	decodedSignature, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return "", false
	}
	mac := hmac.New(sha256.New, s.secret)
	mac.Write(decodedPayload)
	if !hmac.Equal(decodedSignature, mac.Sum(nil)) {
		return "", false
	}
	role := Role(decodedPayload)
	return role, role == RoleAdmin || role == RoleReadonly
}
