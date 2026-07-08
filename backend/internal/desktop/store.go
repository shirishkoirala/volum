package desktop

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/volum-app/volum/backend/internal/sqlutil"
)

type ServiceRecord struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	URL                  string `json:"url"`
	IconURL              string `json:"iconUrl,omitempty"`
	HealthURL            string `json:"healthUrl,omitempty"`
	Description          string `json:"description,omitempty"`
	OpenMode             string `json:"openMode,omitempty"`
	Position             int    `json:"position"`
	CreatedAt            string `json:"createdAt,omitempty"`
	LastHealthStatus     string `json:"lastHealthStatus,omitempty"`
	LastHealthCheckedAt  string `json:"lastHealthCheckedAt,omitempty"`
	LastHealthStatusCode int    `json:"lastHealthStatusCode,omitempty"`
	LastHealthError      string `json:"lastHealthError,omitempty"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

const serviceColumns = `id, name, url, COALESCE(icon_url, ''), COALESCE(health_url, ''), COALESCE(description, ''), COALESCE(open_mode, 'embed'), position, created_at, COALESCE(last_health_status, ''), COALESCE(last_health_checked_at, ''), COALESCE(last_health_status_code, 0), COALESCE(last_health_error, '')`

func scanService(row sqlutil.Scanner) (ServiceRecord, error) {
	var svc ServiceRecord
	var created time.Time
	var checkedAt sql.NullString
	if err := row.Scan(&svc.ID, &svc.Name, &svc.URL, &svc.IconURL, &svc.HealthURL, &svc.Description, &svc.OpenMode, &svc.Position, &created, &svc.LastHealthStatus, &checkedAt, &svc.LastHealthStatusCode, &svc.LastHealthError); err != nil {
		return ServiceRecord{}, err
	}
	svc.CreatedAt = created.Format(time.RFC3339)
	if checkedAt.Valid {
		svc.LastHealthCheckedAt = checkedAt.String
	}
	return svc, nil
}

func (s *Store) ListFavorites(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT path FROM desktop_favorites ORDER BY position, created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}

func (s *Store) AddFavorite(ctx context.Context, path string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO desktop_favorites (path, position, created_at) VALUES (?, 0, ?)`,
		path, now(),
	)
	return err
}

func (s *Store) RemoveFavorite(ctx context.Context, path string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM desktop_favorites WHERE path = ?`, path)
	return err
}

func (s *Store) ReorderFavorites(ctx context.Context, paths []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, p := range paths {
		if _, err := tx.ExecContext(ctx, `UPDATE desktop_favorites SET position = ? WHERE path = ?`, i, p); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ListServices(ctx context.Context) ([]ServiceRecord, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+serviceColumns+` FROM desktop_services ORDER BY position, created_at`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var services []ServiceRecord
	for rows.Next() {
		svc, err := scanService(rows)
		if err != nil {
			return nil, err
		}
		services = append(services, svc)
	}
	return services, rows.Err()
}

func (s *Store) CreateService(ctx context.Context, name, url, iconURL, healthURL, description, openMode string) (*ServiceRecord, error) {
	id := uuid.New().String()
	now := now()
	om := validOpenMode(openMode)
	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO desktop_services (id, name, url, icon_url, health_url, description, open_mode, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
		id, name, url, iconURL, healthURL, description, om, now,
	); err != nil {
		return nil, err
	}
	return &ServiceRecord{
		ID:                  id,
		Name:                name,
		URL:                 url,
		IconURL:             iconURL,
		HealthURL:           healthURL,
		Description:         description,
		OpenMode:            om,
		Position:            0,
		CreatedAt:           now.Format(time.RFC3339),
		LastHealthStatus:    "",
		LastHealthCheckedAt: "",
		LastHealthError:     "",
	}, nil
}

func (s *Store) UpdateService(ctx context.Context, id, name, url, iconURL, healthURL, description, openMode string) (*ServiceRecord, error) {
	om := validOpenMode(openMode)
	res, err := s.db.ExecContext(ctx,
		`UPDATE desktop_services SET name = ?, url = ?, icon_url = ?, health_url = ?, description = ?, open_mode = ? WHERE id = ?`,
		name, url, iconURL, healthURL, description, om, id,
	)
	if err != nil {
		return nil, err
	}
	if err := sqlutil.RequireRowsAffected(res); err != nil {
		return nil, err
	}
	row := s.db.QueryRowContext(ctx,
		`SELECT `+serviceColumns+` FROM desktop_services WHERE id = ?`, id,
	)
	svc, err := scanService(row)
	if err != nil {
		return nil, err
	}
	return &svc, nil
}

func (s *Store) DeleteService(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM desktop_services WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(res)
}

func (s *Store) UpdateServiceHealth(ctx context.Context, id, status string, statusCode int, errorMsg string) error {
	now := now().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx,
		`UPDATE desktop_services SET last_health_status = ?, last_health_checked_at = ?, last_health_status_code = ?, last_health_error = ? WHERE id = ?`,
		status, now, statusCode, errorMsg, id,
	)
	return err
}

func (s *Store) ReorderServices(ctx context.Context, ids []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE desktop_services SET position = ? WHERE id = ?`, i, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func now() time.Time {
	return time.Now().UTC()
}

func validOpenMode(mode string) string {
	if mode != "tab" && mode != "embed" {
		return "embed"
	}
	return mode
}
