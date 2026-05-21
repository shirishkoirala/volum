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

var ErrInvalidConflictPolicy = errors.New("conflict policy must be ask, skip, overwrite, rename, or cancel")

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

func (s *Store) CreateAuditLog(ctx context.Context, action, path, details string) error {
	now := time.Now().UTC()
	log := AuditLog{
		ID:        uuid.NewString(),
		Action:    action,
		Path:      optional(path),
		Details:   optional(details),
		CreatedAt: now,
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audit_logs (id, action, path, details, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, log.ID, log.Action, log.Path, log.Details, log.CreatedAt)
	return err
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

func (s *Store) Retry(ctx context.Context, id string) error {
	now := time.Now().UTC()
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
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return s.ClearItems(ctx, id)
}

func (s *Store) ClaimNextTransferJob(ctx context.Context) (Job, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Job{}, false, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		SELECT id, type, status, source_path, destination_path,
			total_bytes, processed_bytes, total_items, processed_items,
			current_item, error_message, conflict_policy, verify_mode,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE status = ? AND type IN (?, ?)
		ORDER BY created_at ASC
		LIMIT 1
	`, StatusQueued, TypeCopy, TypeMove)

	job, err := scanJob(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}

	now := time.Now().UTC()
	result, err := tx.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, started_at = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusRunning, now, now, job.ID, StatusQueued)
	if err != nil {
		return Job{}, false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Job{}, false, err
	}
	if affected == 0 {
		return Job{}, false, nil
	}
	if err := tx.Commit(); err != nil {
		return Job{}, false, err
	}

	job.Status = StatusRunning
	job.StartedAt = &now
	job.UpdatedAt = now
	return job, true, nil
}

func (s *Store) StartJob(ctx context.Context, jobID string) error {
	now := time.Now().UTC()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, started_at = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusRunning, now, now, jobID, StatusQueued)
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

func (s *Store) SetJobTotals(ctx context.Context, jobID string, totalBytes, totalItems int64) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET total_bytes = ?, total_items = ?, updated_at = ?
		WHERE id = ?
	`, totalBytes, totalItems, now, jobID)
	return err
}

func (s *Store) UpdateJobProgress(ctx context.Context, jobID string, processedBytes, processedItems int64, currentItem string) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET processed_bytes = ?, processed_items = ?, current_item = ?, updated_at = ?
		WHERE id = ?
	`, processedBytes, processedItems, currentItem, now, jobID)
	return err
}

func (s *Store) CompleteJob(ctx context.Context, jobID string) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, current_item = NULL, error_message = NULL, updated_at = ?, completed_at = ?
		WHERE id = ?
	`, StatusCompleted, now, now, jobID)
	return err
}

func (s *Store) FailJob(ctx context.Context, jobID string, cause error) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, error_message = ?, updated_at = ?, completed_at = ?
		WHERE id = ?
	`, StatusFailed, cause.Error(), now, now, jobID)
	return err
}

func (s *Store) IsCancelled(ctx context.Context, jobID string) (bool, error) {
	var status Status
	err := s.db.QueryRowContext(ctx, `SELECT status FROM jobs WHERE id = ?`, jobID).Scan(&status)
	if err != nil {
		return false, err
	}
	return status == StatusCancelled, nil
}

func (s *Store) IsPaused(ctx context.Context, jobID string) (bool, error) {
	var status Status
	err := s.db.QueryRowContext(ctx, `SELECT status FROM jobs WHERE id = ?`, jobID).Scan(&status)
	if err != nil {
		return false, err
	}
	return status == StatusPaused, nil
}

func (s *Store) PauseJob(ctx context.Context, id string) error {
	now := time.Now().UTC()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?
		WHERE id = ? AND status = ?
	`, StatusPaused, now, id, StatusRunning)
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

func (s *Store) ResumeJob(ctx context.Context, id string) error {
	now := time.Now().UTC()
	result, err := s.db.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusQueued, now, id, StatusPaused)
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

func (s *Store) ClearCompleted(ctx context.Context) (int64, error) {
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM job_items WHERE job_id IN (SELECT id FROM jobs WHERE status IN (?, ?))
	`, StatusCompleted, StatusCancelled)
	if err != nil {
		return 0, err
	}
	itemsRemoved, _ := result.RowsAffected()
	result, err = s.db.ExecContext(ctx, `
		DELETE FROM jobs WHERE status IN (?, ?)
	`, StatusCompleted, StatusCancelled)
	if err != nil {
		return 0, err
	}
	jobsRemoved, _ := result.RowsAffected()
	return jobsRemoved + itemsRemoved, nil
}

func (s *Store) ClearFailed(ctx context.Context) (int64, error) {
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM job_items WHERE job_id IN (SELECT id FROM jobs WHERE status = ?)
	`, StatusFailed)
	if err != nil {
		return 0, err
	}
	itemsRemoved, _ := result.RowsAffected()
	result, err = s.db.ExecContext(ctx, `
		DELETE FROM jobs WHERE status = ?
	`, StatusFailed)
	if err != nil {
		return 0, err
	}
	jobsRemoved, _ := result.RowsAffected()
	return jobsRemoved + itemsRemoved, nil
}

func (s *Store) ListItems(ctx context.Context, jobID string) ([]Item, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, job_id, source_path, destination_path, temp_path, size_bytes,
			processed_bytes, status, error_message, checksum, created_at, updated_at
		FROM job_items
		WHERE job_id = ?
		ORDER BY created_at ASC
	`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Item, 0)
	for rows.Next() {
		var item Item
		var temp, errMsg, checksum sql.NullString
		if err := rows.Scan(
			&item.ID, &item.JobID, &item.SourcePath, &item.DestinationPath, &temp,
			&item.SizeBytes, &item.ProcessedBytes, &item.Status, &errMsg, &checksum,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.TempPath = nullString(temp)
		item.ErrorMessage = nullString(errMsg)
		item.Checksum = nullString(checksum)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ClaimNextArchiveJob(ctx context.Context) (Job, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Job{}, false, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		SELECT id, type, status, source_path, destination_path,
			total_bytes, processed_bytes, total_items, processed_items,
			current_item, error_message, conflict_policy, verify_mode,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE status = ? AND type IN (?, ?)
		ORDER BY created_at ASC
		LIMIT 1
	`, StatusQueued, TypeExtract, TypeArchive)

	job, err := scanJob(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}

	now := time.Now().UTC()
	result, err := tx.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, started_at = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusRunning, now, now, job.ID, StatusQueued)
	if err != nil {
		return Job{}, false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Job{}, false, err
	}
	if affected == 0 {
		return Job{}, false, nil
	}
	if err := tx.Commit(); err != nil {
		return Job{}, false, err
	}

	job.Status = StatusRunning
	job.StartedAt = &now
	job.UpdatedAt = now
	return job, true, nil
}

func (s *Store) ClearItems(ctx context.Context, jobID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM job_items WHERE job_id = ?`, jobID)
	return err
}

func (s *Store) CreateItem(ctx context.Context, item Item) (Item, error) {
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	if item.Status == "" {
		item.Status = StatusQueued
	}
	now := time.Now().UTC()
	item.CreatedAt = now
	item.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO job_items (
			id, job_id, source_path, destination_path, temp_path, size_bytes,
			processed_bytes, status, error_message, checksum, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, item.JobID, item.SourcePath, item.DestinationPath, item.TempPath, item.SizeBytes,
		item.ProcessedBytes, item.Status, item.ErrorMessage, item.Checksum, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return Item{}, err
	}
	return item, nil
}

func (s *Store) UpdateItemStatus(ctx context.Context, itemID string, status Status, processedBytes int64, errMessage *string) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE job_items
		SET status = ?, processed_bytes = ?, error_message = ?, updated_at = ?
		WHERE id = ?
	`, status, processedBytes, errMessage, now, itemID)
	return err
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
	case "ask", "skip", "overwrite", "rename", "cancel":
		return true
	default:
		return false
	}
}
