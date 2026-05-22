package shares

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
)

type Share struct {
	ID            string    `json:"id"`
	Path          string    `json:"path"`
	Token         string    `json:"token"`
	PasswordHash  string    `json:"-"`
	ExpiresAt     *string   `json:"expiresAt,omitempty"`
	MaxDownloads  *int      `json:"maxDownloads,omitempty"`
	DownloadCount int       `json:"downloadCount"`
	Enabled       bool      `json:"enabled"`
	CreatedBy     string    `json:"createdBy"`
	CreatedAt     string    `json:"createdAt"`
}

type CreateRequest struct {
	Path         string `json:"path"`
	Password     string `json:"password,omitempty"`
	ExpiresAt    string `json:"expiresAt,omitempty"`
	MaxDownloads *int   `json:"maxDownloads,omitempty"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Create(req CreateRequest, createdBy string) (*Share, error) {
	token, err := generateToken()
	if err != nil {
		return nil, err
	}

	id := generateID()
	now := time.Now().UTC().Format(time.RFC3339)
	var passwordHash string
	if req.Password != "" {
		h := sha256.Sum256([]byte(req.Password))
		passwordHash = hex.EncodeToString(h[:])
	}

	_, err = s.db.Exec(`
		INSERT INTO shares (id, path, token, password_hash, expires_at, max_downloads, enabled, created_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
		id, req.Path, token, passwordHash, nullOrString(req.ExpiresAt), req.MaxDownloads, createdBy, now)
	if err != nil {
		return nil, fmt.Errorf("create share: %w", err)
	}

	return &Share{
		ID:            id,
		Path:          req.Path,
		Token:         token,
		PasswordHash:  passwordHash,
		ExpiresAt:     nullOrStringPtr(req.ExpiresAt),
		MaxDownloads:  req.MaxDownloads,
		DownloadCount: 0,
		Enabled:       true,
		CreatedBy:     createdBy,
		CreatedAt:     now,
	}, nil
}

func (s *Store) List() ([]Share, error) {
	rows, err := s.db.Query(`
		SELECT id, path, token, COALESCE(password_hash,''), expires_at, max_downloads, download_count, enabled, created_by, created_at
		FROM shares ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list shares: %w", err)
	}
	defer rows.Close()

	var shares []Share
	for rows.Next() {
		var sh Share
		var expiresAt, passwordHash sql.NullString
		var maxDownloads sql.NullInt64
		var enabled int
		if err := rows.Scan(&sh.ID, &sh.Path, &sh.Token, &passwordHash, &expiresAt, &maxDownloads, &sh.DownloadCount, &enabled, &sh.CreatedBy, &sh.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan share: %w", err)
		}
		sh.PasswordHash = passwordHash.String
		if expiresAt.Valid {
			sh.ExpiresAt = &expiresAt.String
		}
		if maxDownloads.Valid {
			v := int(maxDownloads.Int64)
			sh.MaxDownloads = &v
		}
		sh.Enabled = enabled == 1
		shares = append(shares, sh)
	}
	if shares == nil {
		shares = []Share{}
	}
	return shares, nil
}

func (s *Store) GetByToken(token string) (*Share, error) {
	var sh Share
	var expiresAt, passwordHash sql.NullString
	var maxDownloads sql.NullInt64
	var enabled int
	err := s.db.QueryRow(`
		SELECT id, path, token, COALESCE(password_hash,''), expires_at, max_downloads, download_count, enabled, created_by, created_at
		FROM shares WHERE token = ?`, token).Scan(
		&sh.ID, &sh.Path, &sh.Token, &passwordHash, &expiresAt, &maxDownloads, &sh.DownloadCount, &enabled, &sh.CreatedBy, &sh.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get share by token: %w", err)
	}
	sh.PasswordHash = passwordHash.String
	if expiresAt.Valid {
		sh.ExpiresAt = &expiresAt.String
	}
	if maxDownloads.Valid {
		v := int(maxDownloads.Int64)
		sh.MaxDownloads = &v
	}
	sh.Enabled = enabled == 1
	return &sh, nil
}

func (s *Store) IncrementDownloadCount(id string) error {
	_, err := s.db.Exec("UPDATE shares SET download_count = download_count + 1 WHERE id = ?", id)
	return err
}

func (s *Store) Delete(id string) error {
	_, err := s.db.Exec("DELETE FROM shares WHERE id = ?", id)
	return err
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func nullOrString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullOrStringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
