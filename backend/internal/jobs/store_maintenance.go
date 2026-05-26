package jobs

import (
	"context"
	"time"
)

func (s *Store) Vacuum(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `VACUUM`)
	return err
}

func (s *Store) PruneJobs(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM job_items WHERE job_id IN (SELECT id FROM jobs WHERE completed_at IS NOT NULL AND completed_at < ?)
	`, cutoff)
	if err != nil {
		return 0, err
	}
	itemsRemoved, _ := result.RowsAffected()
	result, err = s.db.ExecContext(ctx, `
		DELETE FROM jobs WHERE completed_at IS NOT NULL AND completed_at < ?
	`, cutoff)
	if err != nil {
		return 0, err
	}
	jobsRemoved, _ := result.RowsAffected()
	return jobsRemoved + itemsRemoved, nil
}

func (s *Store) PruneAuditLogs(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	result, err := s.db.ExecContext(ctx, `DELETE FROM audit_logs WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
