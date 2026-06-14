package jobs

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

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

func (s *Store) ClearItems(ctx context.Context, jobID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM job_items WHERE job_id = ?`, jobID)
	return err
}

func (s *Store) ListConflictingItems(ctx context.Context, jobID string) ([]Item, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, job_id, source_path, destination_path, temp_path, size_bytes,
			processed_bytes, status, error_message, checksum, created_at, updated_at
		FROM job_items
		WHERE job_id = ? AND status = ?
		ORDER BY created_at ASC
	`, jobID, StatusConflict)
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

func (s *Store) CountConflicts(ctx context.Context, jobID string) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM job_items WHERE job_id = ? AND status = ?
	`, jobID, StatusConflict).Scan(&count)
	return count, err
}

func (s *Store) UpdateItemDestination(ctx context.Context, itemID, newDest string) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE job_items
		SET destination_path = ?, updated_at = ?
		WHERE id = ?
	`, newDest, now, itemID)
	return err
}

func (s *Store) RetryItem(ctx context.Context, jobID, itemID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentStatus Status
	if err := tx.QueryRowContext(ctx, `SELECT status FROM job_items WHERE id = ? AND job_id = ?`, itemID, jobID).Scan(&currentStatus); err != nil {
		return err
	}
	if currentStatus != StatusFailed && currentStatus != StatusCancelled {
		return errors.New("item must be failed or cancelled to retry")
	}

	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx, `
		UPDATE job_items
		SET status = ?, processed_bytes = 0, error_message = NULL, updated_at = ?
		WHERE id = ? AND job_id = ?
	`, StatusQueued, now, itemID, jobID); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE jobs
		SET status = ?, processed_bytes = 0, processed_items = 0,
			current_item = NULL, error_message = NULL,
			updated_at = ?, started_at = NULL, completed_at = NULL
		WHERE id = ? AND status IN (?, ?)
	`, StatusQueued, now, jobID, StatusFailed, StatusCancelled); err != nil {
		return err
	}

	return tx.Commit()
}
