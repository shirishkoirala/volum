package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", path+"?_busy_timeout=5000&_foreign_keys=on")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	if _, err := db.Exec(initialSchema); err != nil {
		return fmt.Errorf("apply initial schema: %w", err)
	}
	_, _ = db.Exec(`ALTER TABLE jobs ADD COLUMN scheduled_at DATETIME`)
	_, _ = db.Exec(`ALTER TABLE jobs ADD COLUMN next_job_id TEXT`)
	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS shares (
			id TEXT PRIMARY KEY,
			path TEXT NOT NULL,
			token TEXT NOT NULL UNIQUE,
			password_hash TEXT,
			expires_at DATETIME,
			max_downloads INTEGER,
			download_count INTEGER DEFAULT 0,
			enabled INTEGER DEFAULT 1,
			created_by TEXT,
			created_at DATETIME NOT NULL
		)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token)`)
	return nil
}

const initialSchema = `
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    source_path TEXT,
    destination_path TEXT,
    total_bytes INTEGER DEFAULT 0,
    processed_bytes INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    current_item TEXT,
    error_message TEXT,
    conflict_policy TEXT DEFAULT 'ask',
    verify_mode TEXT DEFAULT 'size',
    scheduled_at DATETIME,
    next_job_id TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS job_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    source_path TEXT NOT NULL,
    destination_path TEXT NOT NULL,
    temp_path TEXT,
    size_bytes INTEGER DEFAULT 0,
    processed_bytes INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error_message TEXT,
    checksum TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    path TEXT,
    details TEXT,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
`
