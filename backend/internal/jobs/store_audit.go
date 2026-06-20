package jobs

import (
	"context"

	"github.com/google/uuid"
)

func (s *Store) CreateAuditLog(ctx context.Context, action, path, details string) error {
	now := now()
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


