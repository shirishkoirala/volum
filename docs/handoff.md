# Agent Handoff

This document captures the current Volum state so another coding agent can continue without rediscovery.

## Current State

Volum is a self-hosted Docker file manager with a Go backend API, React/Vite frontend, and SQLite-backed job system.

### Core capabilities:
- Browse configured roots, list files, preview images/video/audio/text
- Create folders, rename, move-to-trash with restore, delete permanently
- Upload files with drag-and-drop and size verification
- Download files or directories (streamed as zip on-the-fly)
- Copy/move files via background jobs with conflict policies (ask, skip, overwrite, rename, cancel)
- Archive/extract zip, tar, tar.gz — both creation and extraction
- Checksum verification (md5, sha256) as a background job
- Server-Sent Events for live job progress updates
- Browser notifications for completed/failed jobs
- Job drawer with status filter tabs and collapse completed
- Clear completed/failed jobs from history
- Per-item retry for failed/cancelled items within a job
- Auth with HMAC-signed session cookies (admin/readonly roles)
- Search across all roots with content grep
- Batch rename (pattern-based)
- Recycle bin (`.volum-trash/` per root)
- Keyboard shortcuts, context menus, dark mode

## Repository Notes

- Initial commit: `9175207 Initial Volum scaffold`
- Current branch: `master`
- Runtime/generated files are intentionally ignored:
  - `data/volum.db`
  - `frontend/dist/`
  - `frontend/node_modules/`
  - `storage/README.txt`

## Important Files

- `backend/cmd/volum/main.go`: backend entrypoint and graceful shutdown
- `backend/internal/api/server.go`: HTTP routes and JSON responses
- `backend/internal/security/paths.go`: configured-root path validation
- `backend/internal/files/service.go`: file listing, trash, search
- `backend/internal/jobs/store.go`: SQLite job store with items, audit logs
- `backend/internal/jobs/model.go`: type/status constants and structs
- `backend/internal/worker/worker.go`: background job orchestrator
- `backend/internal/worker/zip.go`: zip archive/extract implementation
- `backend/internal/worker/tar.go`: tar/tar.gz archive/extract implementation
- `backend/internal/worker/checksum.go`: md5/sha256 checksum implementation
- `backend/internal/storage/sqlite.go`: SQLite open and schema migration
- `frontend/src/App.tsx`: main UI shell with all views and dialogs
- `frontend/src/api/client.ts`: frontend API client types and requests
- `frontend/src/styles/global.css`: design tokens and component styles
- `docker-compose.yml`: single-container production-style run
- `docker-compose.dev.yml`: Dockerized backend plus Vite frontend
- `docker-compose.homelab.yml`: Ubuntu/homelab mount layout
- `docs/roadmap.md`: ordered implementation plan with completion status

## Docker Commands

Production-style local Mac run:

```sh
mkdir -p storage data
docker compose up --build
```

Open: `http://localhost:8090`

Dockerized development run:

```sh
mkdir -p storage data
docker compose -f docker-compose.dev.yml up --build
```

Open: `http://localhost:5174` — API at `http://localhost:8090`

## Current Mount Model

For local Mac development:

```txt
./storage -> /storage
./data    -> /data
```

`VOLUM_ROOTS=/storage`, so the UI only shows files placed under the repo's `storage/` directory.

For homelab deployment, use `docker-compose.homelab.yml`.

## Known Implementation Details

- All filesystem operations validated through `RootGuard.Resolve` — root traversal is rejected before filesystem access
- File list responses sort directories first, then names
- Copy/move uses copy-to-temp, verify-size, rename pattern for safety
- Move = copy + verify + delete source (never direct rename across mounts)
- Archive/extract detects format from file extension (.zip, .tar, .tar.gz, .tgz)
- Checksum jobs support md5 and sha256, configurable via verifyMode
- Per-item retry resets the individual item and re-queues the parent job
- Directory download streams a zip archive on-the-fly (no temp file)
- SSE pushes full job list every 1 second; frontend diffs via refs to avoid stale closure bugs
- Frontend dev container maps host port `5174` because `5173` was already in use
- Conflict policies: ask, skip, overwrite, rename, cancel

## Known Gaps

- No automated backend tests (beyond the transfer resume test)
- No frontend component tests
- No image/video thumbnails in grid view
- No drag-select (rubber band) for multi-select
- No column view (macOS Finder style)
- No file/folder info panel (right-click → Get Info)
- No PDF preview (image-based fallback only)
- No export/import job history

## Immediate Next Tasks (from roadmap)

1. Image/video thumbnails in grid view — `Phase 13`
2. Drag-select (rubber band selection) — `Phase 13`
3. Column view (macOS Finder style) — `Phase 13`
4. File/folder info panel — `Phase 13`
5. Export/import job history — `Phase 12`
6. Automated backend tests — `Phase 9+`

## Safety Rules For Next Agent

- Do not bypass `RootGuard` for any filesystem operation.
- Do not overwrite existing files silently.
- Do not implement move as direct rename across arbitrary mounts; move must become copy, verify, delete.
- Do not commit runtime files from `data/`, `storage/`, `frontend/dist/`, or `frontend/node_modules/`.
- Prefer Docker verification because Go is not installed locally in this environment.
- When adding new job types, register in `model.go` constants and add `ClaimNext*Job` in `store.go`.
- SSE backend pushes every 1s; frontend uses refs (not stale state closures) for diffing.
