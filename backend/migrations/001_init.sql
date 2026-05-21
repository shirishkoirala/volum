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
