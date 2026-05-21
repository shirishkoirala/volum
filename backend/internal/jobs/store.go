package jobs

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Create(ctx context.Context, req CreateRequest) (Job, error) {
	if req.Type == "" {
		return Job{}, errors.New("job type is required")
	}
	if req.ConflictPolicy == "" {
		req.ConflictPolicy = "ask"
	}
	if req.VerifyMode == "" {
		req.VerifyMode = "size"
	}

	now := time.Now().UTC()
	job := Job{
		ID:              uuid.NewString(),
		Type:            req.Type,
		Status:          StatusQueued,
		SourcePath:      optional(req.SourcePath),
		DestinationPath: optional(req.DestinationPath),
		ConflictPolicy:  req.ConflictPolicy,
		VerifyMode:      req.VerifyMode,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO jobs (
			id, type, status, source_path, destination_path,
			conflict_policy, verify_mode, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, job.ID, job.Type, job.Status, job.SourcePath, job.DestinationPath, job.ConflictPolicy, job.VerifyMode, job.CreatedAt, job.UpdatedAt)
	if err != nil {
		return Job{}, err
	}

	return job, nil
}

func (s *Store) List(ctx context.Context) ([]Job, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, type, status, source_path, destination_path,
			total_bytes, processed_bytes, total_items, processed_items,
			current_item, error_message, conflict_policy, verify_mode,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		ORDER BY created_at DESC
		LIMIT 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Job, 0)
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, job)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id string) (Job, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, type, status, source_path, destination_path,
			total_bytes, processed_bytes, total_items, processed_items,
			current_item, error_message, conflict_policy, verify_mode,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE id = ?
	`, id)
	return scanJob(row)
}

func (s *Store) Cancel(ctx context.Context, id string) error {
	now := time.Now().UTC()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?, completed_at = ?
		WHERE id = ? AND status IN (?, ?, ?)
	`, StatusCancelled, now, now, id, StatusQueued, StatusRunning, StatusPaused)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) MarkInterruptedRunningJobs(ctx context.Context) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, error_message = ?, updated_at = ?, completed_at = ?
		WHERE status = ?
	`, StatusFailed, "server stopped before job completed; resume validation is not implemented yet", now, now, StatusRunning)
	return err
}

type scanner interface {
	Scan(dest ...any) error
}

func scanJob(row scanner) (Job, error) {
	var job Job
	var source, destination, current, message sql.NullString
	var started, completed sql.NullTime
	if err := row.Scan(
		&job.ID, &job.Type, &job.Status, &source, &destination,
		&job.TotalBytes, &job.ProcessedBytes, &job.TotalItems, &job.ProcessedItems,
		&current, &message, &job.ConflictPolicy, &job.VerifyMode,
		&job.CreatedAt, &job.UpdatedAt, &started, &completed,
	); err != nil {
		return Job{}, err
	}
	job.SourcePath = nullString(source)
	job.DestinationPath = nullString(destination)
	job.CurrentItem = nullString(current)
	job.ErrorMessage = nullString(message)
	if started.Valid {
		job.StartedAt = &started.Time
	}
	if completed.Valid {
		job.CompletedAt = &completed.Time
	}
	return job, nil
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func nullString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}
