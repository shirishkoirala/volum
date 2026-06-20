package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
)

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleReadonly Role = "readonly"
)

type User struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	Role          Role   `json:"role"`
	HasAvatar     bool   `json:"hasAvatar"`
	AvatarVersion int64  `json:"avatarVersion"`
}

type contextKey string

const userKey contextKey = "auth_user"

type Service struct {
	store   *Store
	secret  []byte
	enabled bool
}

func New(store *Store, sessionSecret string) (*Service, error) {
	if store == nil {
		return &Service{}, nil
	}
	if strings.TrimSpace(sessionSecret) == "" {
		generated := make([]byte, 32)
		if _, err := rand.Read(generated); err != nil {
			return nil, err
		}
		return &Service{secret: generated, enabled: true}, nil
	}
	return &Service{
		store:   store,
		secret:  []byte(sessionSecret),
		enabled: true,
	}, nil
}

func (s *Service) Enabled() bool {
	return s.enabled
}

func (s *Service) Login(ctx context.Context, username, password string) (string, User, bool) {
	if !s.enabled {
		return "", User{Role: RoleAdmin}, true
	}
	record, err := s.store.GetByUsername(ctx, username)
	if err != nil || record == nil {
		return "", User{}, false
	}
	if !s.store.VerifyPassword(record, password) {
		return "", User{}, false
	}
	user := User{
		ID:            record.ID,
		Username:      record.Username,
		Role:          record.Role,
		HasAvatar:     record.HasAvatar,
		AvatarVersion: record.UpdatedAt.UnixMilli(),
	}
	return s.sign(record.ID, record.Role), user, true
}

func (s *Service) UserFromRequest(r *http.Request) (User, bool) {
	if !s.enabled {
		return User{Role: RoleAdmin}, true
	}
	cookie, err := r.Cookie("volum_session")
	if err != nil {
		return User{}, false
	}
	userID, role, ok := s.verify(cookie.Value)
	if !ok {
		return User{}, false
	}
	record, err := s.store.GetByID(r.Context(), userID)
	if err != nil || record == nil {
		return User{}, false
	}
	if record.Role != role {
		return User{}, false
	}
	return User{
		ID:            record.ID,
		Username:      record.Username,
		Role:          record.Role,
		HasAvatar:     record.HasAvatar,
		AvatarVersion: record.UpdatedAt.UnixMilli(),
	}, true
}

func (s *Service) SetupRequired(ctx context.Context) (bool, error) {
	if !s.enabled {
		return false, nil
	}
	n, err := s.store.Count(ctx)
	if err != nil {
		return false, err
	}
	return n == 0, nil
}

func (s *Service) WithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, userKey, user)
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(userKey).(User)
	return user, ok
}

func (s *Service) sign(userID string, role Role) string {
	payload := userID + ":" + string(role)
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	signature := mac.Sum(nil)
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func (s *Service) verify(value string) (string, Role, bool) {
	payload, signature, ok := strings.Cut(value, ".")
	if !ok {
		return "", "", false
	}
	decodedPayload, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return "", "", false
	}
	decodedSignature, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return "", "", false
	}
	mac := hmac.New(sha256.New, s.secret)
	mac.Write(decodedPayload)
	if !hmac.Equal(decodedSignature, mac.Sum(nil)) {
		return "", "", false
	}
	userID, role, ok := strings.Cut(string(decodedPayload), ":")
	if !ok {
		return "", "", false
	}
	roleTyped := Role(role)
	return userID, roleTyped, roleTyped == RoleAdmin || roleTyped == RoleReadonly
}
