package jobs

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/volum-app/volum/backend/internal/sqlutil"
)

type Store struct {
	db *sql.DB
}

var ErrInvalidConflictPolicy = errors.New("conflict policy must be ask, skip, overwrite, rename, cancel, or skip_identical")

const jobColumns = `id, type, status, source_path, destination_path,
	total_bytes, processed_bytes, total_items, processed_items,
	current_item, error_message, conflict_policy, verify_mode,
	created_at, updated_at, started_at, completed_at`

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
	if !validConflictPolicy(req.ConflictPolicy) {
		return Job{}, ErrInvalidConflictPolicy
	}
	if req.VerifyMode == "" {
		req.VerifyMode = "size"
	}

	now := now()
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

func (s *Store) List(ctx context.Context, limit, offset int) ([]Job, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT `+jobColumns+`
		FROM jobs
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
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

type ListVersion struct {
	Count         int64
	LatestUpdated string
}

func (s *Store) ListVersion(ctx context.Context) (ListVersion, error) {
	var version ListVersion
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(MAX(updated_at), '1970-01-01T00:00:00Z')
		FROM jobs
	`).Scan(&version.Count, &version.LatestUpdated)
	return version, err
}

func (s *Store) Get(ctx context.Context, id string) (Job, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT `+jobColumns+`
		FROM jobs
		WHERE id = ?
	`, id)
	return scanJob(row)
}

func (s *Store) Cancel(ctx context.Context, id string) error {
	now := now()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?, completed_at = ?
		WHERE id = ? AND status IN (?, ?, ?, ?)
	`, StatusCancelled, now, now, id, StatusQueued, StatusRunning, StatusPaused, StatusNeedsAttention)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(result)
}

func (s *Store) Retry(ctx context.Context, id string) error {
	now := now()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, processed_bytes = 0, processed_items = 0,
			current_item = NULL, error_message = NULL,
			updated_at = ?, started_at = NULL, completed_at = NULL
		WHERE id = ? AND status IN (?, ?)
	`, StatusQueued, now, id, StatusFailed, StatusCancelled)
	if err != nil {
		return err
	}
	if err := sqlutil.RequireRowsAffected(result); err != nil {
		return err
	}
	return s.ClearItems(ctx, id)
}

func (s *Store) StartJob(ctx context.Context, jobID string) error {
	now := now()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, started_at = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusRunning, now, now, jobID, StatusQueued)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(result)
}

func (s *Store) SetJobTotals(ctx context.Context, jobID string, totalBytes, totalItems int64) error {
	now := now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET total_bytes = ?, total_items = ?, updated_at = ?
		WHERE id = ?
	`, totalBytes, totalItems, now, jobID)
	return err
}

func (s *Store) UpdateJobPaths(ctx context.Context, jobID, sourcePath, destinationPath string) error {
	now := now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET source_path = ?, destination_path = ?, updated_at = ?
		WHERE id = ?
	`, sourcePath, destinationPath, now, jobID)
	return err
}

func (s *Store) UpdateJobProgress(ctx context.Context, jobID string, processedBytes, processedItems int64, currentItem string) error {
	now := now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET processed_bytes = ?, processed_items = ?, current_item = ?, updated_at = ?
		WHERE id = ?
	`, processedBytes, processedItems, currentItem, now, jobID)
	return err
}

func (s *Store) CompleteJob(ctx context.Context, jobID string) error {
	now := now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, current_item = NULL, error_message = NULL, updated_at = ?, completed_at = ?
		WHERE id = ?
	`, StatusCompleted, now, now, jobID)
	return err
}

func (s *Store) FailJob(ctx context.Context, jobID string, cause error) error {
	now := now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, error_message = ?, updated_at = ?, completed_at = ?
		WHERE id = ?
	`, StatusFailed, cause.Error(), now, now, jobID)
	return err
}

func (s *Store) GetJobStatus(ctx context.Context, jobID string) (Status, error) {
	var status Status
	err := s.db.QueryRowContext(ctx, `SELECT status FROM jobs WHERE id = ?`, jobID).Scan(&status)
	if err != nil {
		return "", err
	}
	return status, nil
}

func (s *Store) IsCancelled(ctx context.Context, jobID string) (bool, error) {
	status, err := s.GetJobStatus(ctx, jobID)
	if err != nil {
		return false, err
	}
	return status == StatusCancelled, nil
}

func (s *Store) IsPaused(ctx context.Context, jobID string) (bool, error) {
	status, err := s.GetJobStatus(ctx, jobID)
	if err != nil {
		return false, err
	}
	return status == StatusPaused, nil
}

func (s *Store) PauseJob(ctx context.Context, id string) error {
	now := now()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?
		WHERE id = ? AND status = ?
	`, StatusPaused, now, id, StatusRunning)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(result)
}

func (s *Store) ResumeJob(ctx context.Context, id string) error {
	now := now()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusQueued, now, id, StatusPaused)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(result)
}

func (s *Store) ResumeNeedsAttentionJob(ctx context.Context, id string) error {
	now := now()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusQueued, now, id, StatusNeedsAttention)
	if err != nil {
		return err
	}
	return sqlutil.RequireRowsAffected(result)
}

func (s *Store) NeedsAttention(ctx context.Context, jobID string) error {
	now := now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?, current_item = NULL
		WHERE id = ?
	`, StatusNeedsAttention, now, jobID)
	return err
}

func (s *Store) ClearCompleted(ctx context.Context) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		DELETE FROM job_items WHERE job_id IN (SELECT id FROM jobs WHERE status IN (?, ?))
	`, StatusCompleted, StatusCancelled)
	if err != nil {
		return 0, err
	}
	itemsRemoved, _ := result.RowsAffected()
	result, err = tx.ExecContext(ctx, `
		DELETE FROM jobs WHERE status IN (?, ?)
	`, StatusCompleted, StatusCancelled)
	if err != nil {
		return 0, err
	}
	jobsRemoved, _ := result.RowsAffected()
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return jobsRemoved + itemsRemoved, nil
}

func (s *Store) ClearFailed(ctx context.Context) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		DELETE FROM job_items WHERE job_id IN (SELECT id FROM jobs WHERE status = ?)
	`, StatusFailed)
	if err != nil {
		return 0, err
	}
	itemsRemoved, _ := result.RowsAffected()
	result, err = tx.ExecContext(ctx, `
		DELETE FROM jobs WHERE status = ?
	`, StatusFailed)
	if err != nil {
		return 0, err
	}
	jobsRemoved, _ := result.RowsAffected()
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return jobsRemoved + itemsRemoved, nil
}

func (s *Store) CountByStatus(ctx context.Context) (active, completed, failed int, err error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT status, COUNT(*) FROM jobs GROUP BY status
	`)
	if err != nil {
		return 0, 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var status Status
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return 0, 0, 0, err
		}
		switch status {
		case StatusQueued, StatusRunning, StatusPaused:
			active += count
		case StatusCompleted:
			completed += count
		case StatusFailed:
			failed += count
		}
	}
	return active, completed, failed, rows.Err()
}

func (s *Store) MarkInterruptedRunningJobs(ctx context.Context) error {
	now := now()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, current_item = NULL, error_message = ?, updated_at = ?, started_at = NULL
		WHERE status = ? AND type IN (?, ?, ?, ?)
	`, StatusQueued, "server restarted; job will resume", now, StatusRunning, TypeCopy, TypeMove, TypeTrash, TypeRestore); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE job_items
		SET status = ?, updated_at = ?
		WHERE status = ? AND job_id IN (
			SELECT id FROM jobs
			WHERE status = ? AND type IN (?, ?, ?, ?)
		)
	`, StatusQueued, now, StatusRunning, StatusQueued, TypeCopy, TypeMove, TypeTrash, TypeRestore); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, error_message = ?, updated_at = ?, completed_at = ?
		WHERE status = ? AND type NOT IN (?, ?, ?, ?)
	`, StatusFailed, "server stopped before job completed; resume validation is not implemented yet", now, now, StatusRunning, TypeCopy, TypeMove, TypeTrash, TypeRestore); err != nil {
		return err
	}
	return tx.Commit()
}

func scanJob(row sqlutil.Scanner) (Job, error) {
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
	if job.StartedAt != nil && job.ProcessedBytes > 0 {
		elapsed := time.Since(*job.StartedAt).Seconds()
		if elapsed > 0 {
			job.SpeedBytesSec = float64(job.ProcessedBytes) / elapsed
			if job.Status == StatusRunning && job.TotalBytes > job.ProcessedBytes && job.SpeedBytesSec > 0 {
				remaining := int64(float64(job.TotalBytes-job.ProcessedBytes) / job.SpeedBytesSec)
				job.ETASeconds = &remaining
			}
		}
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

func validConflictPolicy(policy string) bool {
	switch policy {
	case "ask", "skip", "overwrite", "rename", "cancel", "skip_identical":
		return true
	default:
		return false
	}
}

func now() time.Time {
	return time.Now().UTC()
}
