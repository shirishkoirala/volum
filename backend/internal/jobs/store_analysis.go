package jobs

import (
	"context"
	"database/sql"
	"errors"
)

type DiskUsageResult struct {
	JobID      string `json:"jobId"`
	Path       string `json:"path"`
	ParentPath string `json:"parentPath"`
	Name       string `json:"name"`
	IsDir      bool   `json:"isDir"`
	SizeBytes  int64  `json:"sizeBytes"`
	FileCount  int64  `json:"fileCount"`
	DirCount   int64  `json:"dirCount"`
}

type DiskUsageSummary struct {
	JobID          string `json:"jobId"`
	TotalBytes     int64  `json:"totalBytes"`
	FileCount      int64  `json:"fileCount"`
	DirectoryCount int64  `json:"directoryCount"`
	SkippedCount   int64  `json:"skippedCount"`
}

type DuplicateResult struct {
	JobID      string  `json:"jobId"`
	GroupID    int     `json:"groupId"`
	Path       string  `json:"path"`
	SizeBytes  int64   `json:"sizeBytes"`
	Checksum   string  `json:"checksum"`
	ModifiedAt *string `json:"modifiedAt,omitempty"`
}

type DuplicateSummary struct {
	JobID            string `json:"jobId"`
	GroupCount       int    `json:"groupCount"`
	FileCount        int    `json:"fileCount"`
	ReclaimableBytes int64  `json:"reclaimableBytes"`
	SkippedCount     int64  `json:"skippedCount"`
}

func (s *Store) ClaimNextAnalyzeJob(ctx context.Context) (Job, bool, error) {
	return s.claimNextJob(ctx, TypeDiskAnalyze)
}

func (s *Store) ClaimNextDuplicateJob(ctx context.Context) (Job, bool, error) {
	return s.claimNextJob(ctx, TypeDuplicateFind)
}

// ── Disk Usage Results ────────────────────────────────────────────

func (s *Store) InsertDiskUsageResults(ctx context.Context, results []DiskUsageResult) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO disk_usage_results (job_id, path, parent_path, name, is_dir, size_bytes, file_count, dir_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, r := range results {
		isDir := 0
		if r.IsDir {
			isDir = 1
		}
		if _, err := stmt.ExecContext(ctx, r.JobID, r.Path, r.ParentPath, r.Name, isDir, r.SizeBytes, r.FileCount, r.DirCount); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ListDiskUsageResults(ctx context.Context, jobID, parentPath string, limit, offset int) ([]DiskUsageResult, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT job_id, path, parent_path, name, is_dir, size_bytes, file_count, dir_count
		FROM disk_usage_results
		WHERE job_id = ? AND parent_path = ?
		ORDER BY is_dir DESC, size_bytes DESC
		LIMIT ? OFFSET ?
	`, jobID, parentPath, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DiskUsageResult
	for rows.Next() {
		var r DiskUsageResult
		var isDir int
		if err := rows.Scan(&r.JobID, &r.Path, &r.ParentPath, &r.Name, &isDir, &r.SizeBytes, &r.FileCount, &r.DirCount); err != nil {
			return nil, err
		}
		r.IsDir = isDir == 1
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) GetDiskUsageSummary(ctx context.Context, jobID string) (*DiskUsageSummary, error) {
	var summary DiskUsageSummary
	summary.JobID = jobID
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(size_bytes), 0), COALESCE(SUM(file_count), 0), COALESCE(SUM(dir_count), 0)
		FROM disk_usage_results
		WHERE job_id = ? AND parent_path = ''
	`, jobID).Scan(&summary.TotalBytes, &summary.FileCount, &summary.DirectoryCount)
	if errors.Is(err, sql.ErrNoRows) {
		return &summary, nil
	}
	if err != nil {
		return nil, err
	}
	return &summary, nil
}

func (s *Store) ClearDiskUsageResults(ctx context.Context, jobID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM disk_usage_results WHERE job_id = ?`, jobID)
	return err
}

// ── Duplicate Results ─────────────────────────────────────────────

func (s *Store) InsertDuplicateResults(ctx context.Context, results []DuplicateResult) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO duplicate_results (job_id, group_id, path, size_bytes, checksum, modified_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, r := range results {
		if _, err := stmt.ExecContext(ctx, r.JobID, r.GroupID, r.Path, r.SizeBytes, r.Checksum, r.ModifiedAt); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ListDuplicateResults(ctx context.Context, jobID string, limit, offset int) ([]DuplicateResult, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT job_id, group_id, path, size_bytes, checksum, modified_at
		FROM duplicate_results
		WHERE job_id = ?
		ORDER BY group_id ASC, path ASC
		LIMIT ? OFFSET ?
	`, jobID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DuplicateResult
	for rows.Next() {
		var r DuplicateResult
		var mod sql.NullString
		if err := rows.Scan(&r.JobID, &r.GroupID, &r.Path, &r.SizeBytes, &r.Checksum, &mod); err != nil {
			return nil, err
		}
		if mod.Valid {
			r.ModifiedAt = &mod.String
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) GetDuplicateSummary(ctx context.Context, jobID string) (*DuplicateSummary, error) {
	var summary DuplicateSummary
	summary.JobID = jobID

	rows, err := s.db.QueryContext(ctx, `
		SELECT group_id, COUNT(*) as cnt, size_bytes
		FROM duplicate_results
		WHERE job_id = ?
		GROUP BY group_id
	`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var groupID, count int
		var size int64
		if err := rows.Scan(&groupID, &count, &size); err != nil {
			return nil, err
		}
		summary.GroupCount++
		summary.FileCount += count
		if count > 1 {
			summary.ReclaimableBytes += size * int64(count-1)
		}
	}
	return &summary, rows.Err()
}

func (s *Store) ClearDuplicateResults(ctx context.Context, jobID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM duplicate_results WHERE job_id = ?`, jobID)
	return err
}
