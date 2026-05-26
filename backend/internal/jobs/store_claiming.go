package jobs

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

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
			scheduled_at, next_job_id,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE status = ? AND type IN (?, ?)
			AND (scheduled_at IS NULL OR scheduled_at <= ?)
		ORDER BY created_at ASC
		LIMIT 1
	`, StatusQueued, TypeCopy, TypeMove, time.Now().UTC())

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
			scheduled_at, next_job_id,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE status = ? AND type IN (?, ?)
			AND (scheduled_at IS NULL OR scheduled_at <= ?)
		ORDER BY created_at ASC
		LIMIT 1
	`, StatusQueued, TypeExtract, TypeArchive, time.Now().UTC())

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

func (s *Store) ClaimNextChecksumJob(ctx context.Context) (Job, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Job{}, false, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		SELECT id, type, status, source_path, destination_path,
			total_bytes, processed_bytes, total_items, processed_items,
			current_item, error_message, conflict_policy, verify_mode,
			scheduled_at, next_job_id,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE status = ? AND type = ?
			AND (scheduled_at IS NULL OR scheduled_at <= ?)
		ORDER BY created_at ASC
		LIMIT 1
	`, StatusQueued, TypeChecksum, time.Now().UTC())

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
