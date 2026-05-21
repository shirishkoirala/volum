# Agent Handoff

This document captures the current Volum state so another coding agent can continue without rediscovery.

## Current State

Volum is an early MVP scaffold for a self-hosted Docker file manager. The current app can:

- Run through Docker on macOS.
- Serve a Go backend API.
- Serve a React/Vite frontend in a separate dev container.
- Browse configured roots.
- List files in the mounted storage folder.
- Persist job schema in SQLite.
- Return an empty jobs array safely.

The reliable filesystem job engine is not implemented yet. Current jobs support is persistence/API scaffolding only.

## Repository Notes

- Initial commit exists: `9175207 Initial Volum scaffold`
- Current branch: `master`
- `docs/roadmap.md` is currently uncommitted unless a later agent commits it.
- Runtime/generated files are intentionally ignored:
  - `data/volum.db`
  - `frontend/dist/`
  - `frontend/node_modules/`
  - `storage/README.txt`

## Important Files

- `backend/cmd/volum/main.go`: backend entrypoint and graceful shutdown
- `backend/internal/api/server.go`: HTTP routes and JSON responses
- `backend/internal/security/paths.go`: configured-root path validation
- `backend/internal/files/service.go`: file listing
- `backend/internal/jobs/store.go`: SQLite job store
- `backend/internal/storage/sqlite.go`: SQLite open and schema migration
- `frontend/src/App.tsx`: main UI shell
- `frontend/src/api/client.ts`: frontend API client types and requests
- `docker-compose.yml`: single-container macOS production-style run
- `docker-compose.dev.yml`: Dockerized backend plus Vite frontend
- `docker-compose.homelab.yml`: Ubuntu/homelab mount layout
- `docs/roadmap.md`: ordered implementation plan

## Docker Commands

Production-style local Mac run:

```sh
mkdir -p storage data
docker compose up --build
```

Open:

```txt
http://localhost:8090
```

Dockerized development run:

```sh
mkdir -p storage data
docker compose -f docker-compose.dev.yml up --build
```

Open:

```txt
http://localhost:5174
```

The API remains available at:

```txt
http://localhost:8090
```

## Verified Endpoints

These worked during the last verification:

```txt
GET http://localhost:8090/healthz
GET http://localhost:5174/api/roots
GET http://localhost:5174/api/files?path=/storage&hidden=false
GET http://localhost:5174/api/jobs
```

Expected empty jobs response:

```json
{"jobs":[]}
```

## Current Mount Model

For local Mac development:

```txt
./storage -> /storage
./data    -> /data
```

`VOLUM_ROOTS=/storage`, so the UI only shows files placed under the repo's `storage/` directory.

For homelab deployment, use `docker-compose.homelab.yml`.

## Known Implementation Details

- The backend currently validates access through `RootGuard.Resolve`.
- Root traversal is rejected before filesystem access.
- File list responses sort directories first, then names.
- Empty jobs now return an empty slice instead of `null`.
- The frontend also defensively converts nullable arrays to empty arrays.
- The frontend dev container maps host port `5174` to Vite port `5173` because `5173` was already in use on the Mac.

## Known Gaps

- No create folder API yet.
- No rename API yet.
- No delete API yet.
- No download API yet.
- No upload API yet.
- No real copy/move/delete worker yet.
- No job item expansion or progress calculations yet.
- No Server-Sent Events or WebSocket updates yet.
- No auth or roles yet.
- No automated backend tests yet.
- No frontend component tests yet.

## Recommended Next Step

Implement Phase 1 file actions:

1. Add backend APIs:
   - `POST /api/files/folder`
   - `PATCH /api/files/rename`
   - `DELETE /api/files`
   - `GET /api/files/download`
2. Validate every path through `RootGuard`.
3. Require explicit confirmation for delete from the frontend.
4. Add frontend action buttons/dialogs.
5. Rebuild with:

```sh
npm run build
docker compose -f docker-compose.dev.yml up --build -d
```

## Safety Rules For Next Agent

- Do not bypass `RootGuard` for any filesystem operation.
- Do not overwrite existing files silently.
- Do not implement move as direct rename across arbitrary mounts; move must become copy, verify, delete.
- Do not commit runtime files from `data/`, `storage/`, `frontend/dist/`, or `frontend/node_modules/`.
- Prefer Docker verification because Go is not installed locally in this environment.
