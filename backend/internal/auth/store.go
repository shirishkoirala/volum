package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/volum-app/volum/backend/internal/sqlutil"
	"golang.org/x/crypto/bcrypt"
)

type UserRecord struct {
	ID             string
	Username       string
	PasswordHash   string
	Role           Role
	CreatedAt      time.Time
	UpdatedAt      time.Time
	HasAvatar      bool
	SessionVersion int64
}

type Avatar struct {
	Data []byte
	MIME string
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) CreateUser(ctx context.Context, username, password string, role Role) (*UserRecord, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	now := now()
	id := uuid.New().String()
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, username, string(hash), string(role), now, now,
	)
	if err != nil {
		return nil, err
	}
	return &UserRecord{
		ID:           id,
		Username:     username,
		PasswordHash: string(hash),
		Role:         role,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

const userColumns = `id, username, password_hash, role, created_at, updated_at, COALESCE(session_version, 0),
	avatar_data IS NOT NULL AND length(avatar_data) > 0`

func (s *Store) GetByUsername(ctx context.Context, username string) (*UserRecord, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT `+userColumns+` FROM users WHERE username = ?`,
		username,
	)
	return scanUser(row)
}

func (s *Store) GetByID(ctx context.Context, id string) (*UserRecord, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = ?`,
		id,
	)
	return scanUser(row)
}

func (s *Store) ListUsers(ctx context.Context) ([]UserRecord, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+userColumns+` FROM users ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []UserRecord
	for rows.Next() {
		u, err := scanUserFromRows(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *u)
	}
	return users, rows.Err()
}

func (s *Store) DeleteUser(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(res)
}

func (s *Store) UpdatePassword(ctx context.Context, id, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?`,
		string(hash), now(), id,
	)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(res)
}

func (s *Store) BumpSessionVersion(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?`,
		now(), id,
	)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(res)
}

func (s *Store) UpdateRole(ctx context.Context, id string, role Role) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`,
		string(role), now(), id,
	)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(res)
}

func (s *Store) GetAvatar(ctx context.Context, id string) (*Avatar, error) {
	var avatar Avatar
	err := s.db.QueryRowContext(ctx,
		`SELECT avatar_data, avatar_mime FROM users WHERE id = ? AND avatar_data IS NOT NULL`, id,
	).Scan(&avatar.Data, &avatar.MIME)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &avatar, nil
}

func (s *Store) UpdateAvatar(ctx context.Context, id string, data []byte, mime string) (time.Time, error) {
	updatedAt := now()
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET avatar_data = ?, avatar_mime = ?, updated_at = ? WHERE id = ?`,
		data, mime, updatedAt, id,
	)
	if err != nil {
		return time.Time{}, err
	}
	if err := sqlutil.RequireRowsAffected(res); err != nil {
		return time.Time{}, err
	}
	return updatedAt, nil
}

func (s *Store) DeleteAvatar(ctx context.Context, id string) (time.Time, error) {
	updatedAt := now()
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET avatar_data = NULL, avatar_mime = '', updated_at = ? WHERE id = ?`,
		updatedAt, id,
	)
	if err != nil {
		return time.Time{}, err
	}
	if err := sqlutil.RequireRowsAffected(res); err != nil {
		return time.Time{}, err
	}
	return updatedAt, nil
}

func (s *Store) Count(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) VerifyPassword(record *UserRecord, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(record.PasswordHash), []byte(password)) == nil
}

func scanUser(row *sql.Row) (*UserRecord, error) {
	var u UserRecord
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt, &u.SessionVersion, &u.HasAvatar)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func scanUserFromRows(row sqlutil.Scanner) (*UserRecord, error) {
	var u UserRecord
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt, &u.SessionVersion, &u.HasAvatar)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func now() time.Time {
	return time.Now().UTC()
}
