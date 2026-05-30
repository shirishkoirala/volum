package jobs

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

func (s *Store) claimNextJob(ctx context.Context, types ...Type) (Job, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Job{}, false, err
	}
	defer tx.Rollback()

	query := `
		SELECT id, type, status, source_path, destination_path,
			total_bytes, processed_bytes, total_items, processed_items,
			current_item, error_message, conflict_policy, verify_mode,
			scheduled_at, next_job_id,
			created_at, updated_at, started_at, completed_at
		FROM jobs
		WHERE status = ? AND type IN (?` + repeatParams(len(types)-1) + `)
			AND (scheduled_at IS NULL OR scheduled_at <= ?)
		ORDER BY created_at ASC
		LIMIT 1`

	args := []any{StatusQueued}
	for _, t := range types {
		args = append(args, t)
	}
	args = append(args, time.Now().UTC())

	row := tx.QueryRowContext(ctx, query, args...)
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

func repeatParams(n int) string {
	if n <= 0 {
		return ""
	}
	b := make([]byte, n*2-1)
	for i := range b {
		if i%2 == 0 {
			b[i] = '?'
		} else {
			b[i] = ','
		}
	}
	return "," + string(b)
}

func (s *Store) ClaimNextTransferJob(ctx context.Context) (Job, bool, error) {
	return s.claimNextJob(ctx, TypeCopy, TypeMove)
}

func (s *Store) ClaimNextArchiveJob(ctx context.Context) (Job, bool, error) {
	return s.claimNextJob(ctx, TypeExtract, TypeArchive)
}

func (s *Store) ClaimNextChecksumJob(ctx context.Context) (Job, bool, error) {
	return s.claimNextJob(ctx, TypeChecksum)
}
