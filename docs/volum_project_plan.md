# Volum Project Plan

## 1. Project Summary

**Volum** is a self-hosted web file manager for Ubuntu/Docker home servers.

The goal is to build a modern file manager inspired by the CasaOS File Manager, but with a more reliable backend architecture for large file operations.

The most important requirement is that long-running file operations such as copy, move, upload, extract, and delete must continue on the server even if the browser window is closed.

Volum should feel simple and clean in the browser, but internally it should behave like a reliable filesystem job engine.

---

## 2. Core Goals

- Build a CasaOS-style web file manager.
- Use a Go backend for reliability and performance.
- Use a React frontend for a modern UI.
- Run as a Docker container on Ubuntu Server.
- Support mounted folders such as `/mnt/storage`, `/mnt/data1`, `/mnt/data2`, `/mnt/backup`, and `/opt/docker`.
- Make large file operations safe, resumable where possible, and persistent.
- Prevent accidental data loss.
- Keep long-running jobs alive even when the browser closes.
- Persist all job state in SQLite.
- Provide a clean dashboard for active, completed, failed, and cancelled jobs.

---

## 3. Recommended Tech Stack

### Frontend

- React
- Vite or Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Server-Sent Events or WebSocket for live job progress

### Backend

- Go
- SQLite
- chi, gin, echo, or fiber for HTTP routing
- Native Go filesystem APIs
- Background worker queue
- Structured logging
- Docker Compose deployment

### Storage

- SQLite database stored under:

```txt
/opt/docker/volum/data/volum.db
```

### Host Mounts

Example configured roots:

```txt
/mnt/storage
/mnt/data1
/mnt/data2
/mnt/backup
/opt/docker
```

---

## 4. High-Level Architecture

```txt
Browser UI
   |
   v
Go API Server
   |
   v
SQLite Job Store
   |
   v
Background Worker
   |
   v
Filesystem
```

The frontend should not directly control long-running file operations.

Instead:

```txt
User starts copy/move
   |
   v
Backend creates persistent job
   |
   v
Worker processes job
   |
   v
Progress saved to SQLite
   |
   v
Frontend subscribes to updates
```

If the browser closes, the worker keeps running.

When the browser opens again, the UI reads active jobs from SQLite and reconnects to progress updates.

---

## 5. Core Features

### File Browsing

- Browse configured root folders
- Breadcrumb navigation
- List view
- Grid view
- File/folder icons
- File size
- Modified date
- Permissions
- Hidden file toggle
- Sort by name, size, type, date
- Search within current folder
- Refresh folder

### File Actions

- Create folder
- Rename file/folder
- Delete file/folder
- Copy file/folder
- Move file/folder
- Upload files
- Download files
- Multi-select
- Context menu
- Drag and drop upload

### Preview

- Image preview
- Video preview
- Audio preview
- Text/code preview
- PDF preview if practical
- Basic metadata display

---

## 6. Long-Running Job System

Long-running operations must be handled as persistent jobs.

### Job Types

```txt
copy
move
delete
upload
extract
archive
checksum
```

### Job Statuses

```txt
queued
running
paused
completed
failed
cancelled
needs_attention
```

### Required Job Features

- Create job
- Start job
- Persist progress
- Show active progress
- Cancel job
- Retry failed job
- Resume safe jobs where possible
- Keep job history
- Show current file being processed
- Show total bytes
- Show copied bytes
- Show transfer speed
- Show ETA
- Show error message

---

## 7. Failure Prevention Strategy

The most important part of Volum is data safety.

### Copy Safety Rules

Never copy directly into the final destination filename.

Use a partial temporary file first:

```txt
destination/.volum-tmp/filename.partial
```

After copy completes:

1. Verify copied size.
2. Optionally verify checksum.
3. Atomically rename partial file to final destination.
4. Mark item as completed.

### Move Safety Rules

A move should be treated as:

```txt
safe copy
verify destination
delete source only after success
```

Never delete the source before destination verification succeeds.

### Delete Safety Rules

For MVP, destructive delete should require confirmation.

Optional later feature:

```txt
soft delete / recycle bin
```

Example trash path:

```txt
.volum-trash/
```

### Conflict Handling

When destination exists, support:

```txt
skip
overwrite
rename
cancel
ask
```

Default should be:

```txt
ask
```

Never overwrite silently.

### Failure Detection

The worker should detect and report:

- Permission denied
- Disk full
- Missing source
- Missing destination
- Destination disconnected
- Source disappeared
- File changed during copy
- Name conflict
- Unsupported file type
- Path traversal attempt
- Read-only mount
- Interrupted server shutdown

---

## 8. Resume and Recovery

When Volum starts, it should scan the database for interrupted jobs.

### Startup Recovery Rules

```txt
queued     -> keep queued
running    -> mark as failed or recoverable
paused     -> keep paused
completed  -> keep completed
failed     -> keep failed
cancelled  -> keep cancelled
```

For interrupted copy jobs:

- If partial file exists, compare partial size with source size.
- If safe, resume from last copied byte.
- If not safe, restart item copy.
- Never assume partial files are valid without verification.

---

## 9. Database Design

### jobs Table

```sql
CREATE TABLE jobs (
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
```

### job_items Table

```sql
CREATE TABLE job_items (
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
```

### audit_logs Table

```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    path TEXT,
    details TEXT,
    created_at DATETIME NOT NULL
);
```

---

## 10. API Design

### Files

```txt
GET    /api/roots
GET    /api/files?path=/mnt/storage
POST   /api/files/folder
PATCH  /api/files/rename
DELETE /api/files
GET    /api/files/download?path=/mnt/storage/file.mkv
POST   /api/files/upload
```

### Jobs

```txt
POST   /api/jobs/copy
POST   /api/jobs/move
POST   /api/jobs/delete
GET    /api/jobs
GET    /api/jobs/{id}
POST   /api/jobs/{id}/cancel
POST   /api/jobs/{id}/retry
POST   /api/jobs/{id}/pause
POST   /api/jobs/{id}/resume
GET    /api/jobs/{id}/events
```

### Auth

```txt
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

---

## 11. Security Requirements

### Path Safety

Volum must only access configured root folders.

Configured roots example:

```txt
VOLUM_ROOTS=/mnt/storage,/mnt/data1,/mnt/data2,/mnt/backup,/opt/docker
```

Rules:

- Reject path traversal.
- Reject `../`.
- Resolve symlinks carefully.
- Ensure final resolved path is inside an allowed root.
- Do not expose `/` unless explicitly configured.
- Never trust frontend paths directly.

### User Roles

MVP roles:

```txt
admin
readonly
```

Admin can:

- upload
- download
- copy
- move
- rename
- delete
- manage jobs

Readonly can:

- browse
- preview
- download

### Recommended Access

For your homelab, expose Volum only through:

```txt
Tailscale
```

Optional later:

```txt
Cloudflare Tunnel + authentication
```

---

## 12. UI Plan

### Main Layout

```txt
Sidebar:
- Storage roots
- Favorites
- Recent locations

Main Area:
- Breadcrumb
- Toolbar
- File grid/list
- Context menu

Right/Bottom Drawer:
- Active jobs
- Completed jobs
- Failed jobs
```

### CasaOS-Inspired UI

The UI should feel:

- simple
- clean
- rounded
- modern
- spacious
- friendly
- minimal

Avoid copying CasaOS branding directly.

Volum should have its own visual identity.

### Job Drawer

Show:

- Job name
- Job type
- Progress bar
- Current file
- Speed
- ETA
- Status
- Cancel button
- Retry button for failed jobs

---

## 13. Docker Compose

```yaml
services:
  volum:
    image: volum/volum:latest
    container_name: volum
    ports:
      - "8090:8090"
    volumes:
      - /mnt:/mnt
      - /opt/docker:/opt/docker
      - /opt/docker/volum:/data
    environment:
      - VOLUM_ROOTS=/mnt/storage,/mnt/data1,/mnt/data2,/mnt/backup,/opt/docker
      - VOLUM_DB=/data/volum.db
      - VOLUM_PORT=8090
    restart: unless-stopped
```

---

## 14. Suggested Repository Structure

```txt
volum/
├── backend/
│   ├── cmd/
│   │   └── volum/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── files/
│   │   ├── jobs/
│   │   ├── storage/
│   │   ├── worker/
│   │   └── security/
│   ├── migrations/
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── styles/
│   └── package.json
├── docker-compose.yml
├── Dockerfile
├── README.md
└── docs/
    ├── architecture.md
    ├── jobs.md
    └── security.md
```

---

## 15. MVP Milestones

### Milestone 1: Backend Foundation

- Go HTTP server
- Config loading
- SQLite setup
- Root folder validation
- Basic file listing API
- Path traversal protection

### Milestone 2: Basic UI

- React app
- Sidebar roots
- Browse folders
- Breadcrumb
- List/grid view
- File actions menu

### Milestone 3: Job Engine

- Job table
- Job creation API
- Background worker
- Copy file job
- Copy folder job
- Progress tracking
- SSE/WebSocket progress

### Milestone 4: Safe Operations

- Temporary partial files
- Size verification
- Atomic rename
- Safe move
- Retry failed job
- Cancel job

### Milestone 5: Upload/Download

- File upload
- Large upload handling
- Download files
- Optional folder archive download

### Milestone 6: Authentication

- Login
- Session/JWT
- Admin user
- Read-only user
- Audit logs

### Milestone 7: Polish

- Job drawer
- Better previews
- Conflict handling
- Mobile layout
- Docker image
- Documentation

---

## 16. AI Coding Agent Prompt

Use this prompt to start the project with an AI coding agent.

```txt
Create a self-hosted web file manager called Volum.

Volum should be inspired by CasaOS File Manager but must have its own branding and UI.

The backend must be written in Go. The frontend should be React with TypeScript, Tailwind CSS, and shadcn/ui. The database should be SQLite.

The app will run on Ubuntu Server inside Docker Compose.

Main requirement:
Long-running file operations such as copy, move, delete, upload, archive, and extract must continue on the server even if the browser is closed. The browser should only create jobs and subscribe to progress updates.

Architecture:
- React frontend
- Go API backend
- SQLite database
- Persistent job queue
- Background worker
- Server-Sent Events or WebSocket progress updates
- Docker Compose deployment

Configured roots:
Use an environment variable called VOLUM_ROOTS to define allowed folders.
Example:
VOLUM_ROOTS=/mnt/storage,/mnt/data1,/mnt/data2,/mnt/backup,/opt/docker

Security:
- Only allow access inside configured root folders.
- Prevent path traversal.
- Resolve and validate paths server-side.
- Do not trust frontend paths.
- Support admin and readonly users.
- Log destructive actions.

File manager features:
- Browse folders
- Breadcrumb navigation
- List and grid views
- Create folder
- Rename
- Delete
- Copy
- Move
- Upload
- Download
- Preview images, videos, text files, and PDFs where practical
- Show file size, modified date, and permissions

Job engine features:
- Persistent jobs in SQLite
- Background worker independent of browser lifecycle
- Active/completed/failed/cancelled job history
- Progress percentage
- Total bytes
- Copied bytes
- Current file
- Transfer speed
- ETA
- Cancel job
- Retry failed job
- Resume safe interrupted copy jobs where possible

Robust copy behavior:
- Never copy directly to the final destination filename.
- Copy to a temporary .partial file inside a .volum-tmp folder.
- Verify file size after copy.
- Optionally support checksum verification.
- Rename temp file atomically after successful verification.
- Never overwrite destination files unless explicitly confirmed.

Robust move behavior:
- Treat move as copy + verify + delete source.
- Delete source only after the destination is confirmed successful.
- If move fails, keep the source untouched.

Failure handling:
- Detect permission denied.
- Detect disk full.
- Detect source missing.
- Detect destination missing.
- Detect destination disconnected.
- Detect file changed during copy.
- Detect name conflicts.
- Persist job state after each file.
- On server restart, inspect unfinished jobs and mark them failed or recoverable safely.

Create:
- backend Go project
- frontend React project
- SQLite migrations
- Dockerfile
- docker-compose.yml
- README.md
- basic architecture docs

Prioritize data safety over speed.
```

---

## 17. Development Rule

For Volum, the priority order should be:

```txt
1. Data safety
2. Reliability
3. Clear progress visibility
4. Simple UX
5. Performance
6. Extra features
```

Do not add dangerous shortcuts just to make the UI feel faster.

---

## 18. Final Recommendation

Build Volum in this order:

```txt
1. Go backend
2. Path safety
3. SQLite job store
4. Copy job worker
5. Progress API
6. React UI
7. Move/delete/upload
8. Auth
9. Polish
```

The core product is not the file list UI.

The real product is the reliable background filesystem job engine.
