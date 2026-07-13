package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

	db.SetMaxOpenConns(1)

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

	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'readonly',
			avatar_data BLOB,
			avatar_mime TEXT DEFAULT '',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`)
	if err := addColumnIfMissing(db, "users", "avatar_data", "BLOB"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "users", "avatar_mime", "TEXT DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "users", "session_version", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS desktop_favorites (
			path TEXT NOT NULL PRIMARY KEY,
			position INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL
		)`)
	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS desktop_services (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			url TEXT NOT NULL,
			icon_url TEXT DEFAULT '',
			health_url TEXT DEFAULT '',
			position INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL
		)`)
	if err := addColumnIfMissing(db, "desktop_services", "health_url", "TEXT DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "desktop_services", "description", "TEXT DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "desktop_services", "open_mode", "TEXT DEFAULT 'embed'"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "desktop_services", "last_health_status", "TEXT DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "desktop_services", "last_health_checked_at", "DATETIME"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "desktop_services", "last_health_status_code", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "desktop_services", "last_health_error", "TEXT DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "job_items", "conflict_resolution", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "jobs", "scheduled_at", "DATETIME"); err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, type, scheduled_at, created_at)`); err != nil {
		return fmt.Errorf("create job claim index: %w", err)
	}

	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS disk_usage_results (
			job_id TEXT NOT NULL,
			path TEXT NOT NULL,
			parent_path TEXT,
			name TEXT NOT NULL,
			is_dir INTEGER NOT NULL DEFAULT 0,
			size_bytes INTEGER NOT NULL DEFAULT 0,
			file_count INTEGER NOT NULL DEFAULT 0,
			dir_count INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
		)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_disk_usage_job ON disk_usage_results(job_id, parent_path)`)

	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS duplicate_results (
			job_id TEXT NOT NULL,
			group_id INTEGER NOT NULL,
			path TEXT NOT NULL,
			size_bytes INTEGER NOT NULL DEFAULT 0,
			checksum TEXT NOT NULL,
			modified_at DATETIME,
			FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
		)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_duplicate_job ON duplicate_results(job_id, group_id)`)

	return nil
}

func addColumnIfMissing(db *sql.DB, table, column, colType string) error {
	_, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, colType))
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		return err
	}
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
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    scheduled_at DATETIME
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
