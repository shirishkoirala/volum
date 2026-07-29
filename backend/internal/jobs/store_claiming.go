package jobs

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/volum-app/volum/backend/internal/sqlutil"
)

func (s *Store) claimNextJob(ctx context.Context, types ...Type) (Job, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Job{}, false, err
	}
	defer tx.Rollback()

	query := `
		SELECT ` + jobColumns + `
		FROM jobs
		WHERE status = ? AND type IN (?` + strings.Repeat(",?", max(0, len(types)-1)) + `)
		ORDER BY created_at ASC
		LIMIT 1`

	args := []any{StatusQueued}
	for _, t := range types {
		args = append(args, t)
	}

	row := tx.QueryRowContext(ctx, query, args...)
	job, err := scanJob(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}

	now := now()
	result, err := tx.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, started_at = ?, updated_at = ?, error_message = NULL
		WHERE id = ? AND status = ?
	`, StatusRunning, now, now, job.ID, StatusQueued)
	if err != nil {
		return Job{}, false, err
	}
	if err := sqlutil.RequireRowsAffected(result); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Job{}, false, nil
		}
		return Job{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return Job{}, false, err
	}

	job.Status = StatusRunning
	job.StartedAt = &now
	job.UpdatedAt = now
	return job, true, nil
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

func (s *Store) ClaimNextTrashJob(ctx context.Context) (Job, bool, error) {
	return s.claimNextJob(ctx, TypeTrash, TypeRestore)
}
