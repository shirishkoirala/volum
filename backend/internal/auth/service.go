package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
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

func (s *Service) Login(ctx context.Context, username, password string, remember bool) (string, User, bool) {
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
	return s.sign(record.ID, record.Role, record.SessionVersion, remember), user, true
}

func (s *Service) UserFromRequest(r *http.Request) (User, bool) {
	if !s.enabled {
		return User{Role: RoleAdmin}, true
	}
	cookie, err := r.Cookie("volum_session")
	if err != nil {
		return User{}, false
	}
	claims, ok := s.verify(cookie.Value)
	if !ok {
		return User{}, false
	}
	record, err := s.store.GetByID(r.Context(), claims.userID)
	if err != nil || record == nil {
		return User{}, false
	}
	if record.Role != claims.role {
		return User{}, false
	}
	if record.SessionVersion != claims.sessionVer {
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

func SecureEqual(left, right string) bool {
	return hmac.Equal([]byte(left), []byte(right))
}

// tokenClaims holds the parsed session token fields.
type tokenClaims struct {
	userID     string
	role       Role
	issuedAt   int64
	expiresAt  int64
	sessionVer int64
}

func (s *Service) sign(userID string, role Role, sessionVer int64, remember bool) string {
	now := time.Now().Unix()
	exp := now + 3600 // default: 1 hour
	if remember {
		exp = now + 7*24*3600 // 7 days
	}
	payload := fmt.Sprintf("%s:%s:%d:%d:%d", userID, role, now, exp, sessionVer)
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	signature := mac.Sum(nil)
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func (s *Service) verify(value string) (tokenClaims, bool) {
	payload, signature, ok := strings.Cut(value, ".")
	if !ok {
		return tokenClaims{}, false
	}
	decodedPayload, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return tokenClaims{}, false
	}
	decodedSignature, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return tokenClaims{}, false
	}
	mac := hmac.New(sha256.New, s.secret)
	mac.Write(decodedPayload)
	if !hmac.Equal(decodedSignature, mac.Sum(nil)) {
		return tokenClaims{}, false
	}

	parts := strings.SplitN(string(decodedPayload), ":", 5)
	if len(parts) != 5 {
		return tokenClaims{}, false
	}

	userID := parts[0]
	roleTyped := Role(parts[1])
	iat, _ := strconv.ParseInt(parts[2], 10, 64)
	exp, _ := strconv.ParseInt(parts[3], 10, 64)
	sessionVer, _ := strconv.ParseInt(parts[4], 10, 64)

	// Reject expired tokens.
	if time.Now().Unix() > exp {
		return tokenClaims{}, false
	}

	if roleTyped != RoleAdmin && roleTyped != RoleReadonly {
		return tokenClaims{}, false
	}

	return tokenClaims{
		userID:     userID,
		role:       roleTyped,
		issuedAt:   iat,
		expiresAt:  exp,
		sessionVer: sessionVer,
	}, true
}
