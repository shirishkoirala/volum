# Volum — Agent Memory

## Build & Run

- **Production build**: `docker compose -f docker-compose.server.yml up --build -d`
- **Frontend dev**: `cd frontend && npm run dev` (port 5174, API on 8090)
- **TypeScript check**: `cd frontend && npx tsc --noEmit`
- **Full frontend build**: `cd frontend && npm run build`
- **Go is NOT installed locally** — always verify backend via Docker build

## Architecture

### Backend (`backend/`)
- Go + chi router + SQLite (via mattn/go-sqlite3)
- Entry: `backend/cmd/volum/main.go`
- Routes: `backend/internal/api/server.go` — `routes()` method registers all endpoints
- Auth: HMAC-signed session cookies, admin/readonly roles
- All filesystem ops validated through `RootGuard.Resolve` (no raw path access)
- Move = copy + verify + delete (never direct rename across mounts)
- Job store: `backend/internal/jobs/store.go`
- Worker: `backend/internal/worker/worker.go` — polls every 1s for new jobs
- SSE: pushes full job list every 1s; frontend diffs via refs

### Frontend (`frontend/`)
- React 19 + Vite + TypeScript
- Entry: `frontend/src/App.tsx` — main shell with sidebar, workspace, job drawer
- API client: `frontend/src/api/client.ts` — typed request functions
- CSS Modules: every component has `*.module.css`, Vite auto-hashes class names
- Shared styles: `frontend/src/styles/global.css` (utility classes), `tokens.css` (theme vars)

## Key Files

### Backend
- `backend/internal/api/server.go` — HTTP routes and handlers
- `backend/internal/jobs/store.go` — SQLite job store + audit logs
- `backend/internal/worker/worker.go` — background job orchestrator
- `backend/internal/security/paths.go` — RootGuard path validation
- `backend/internal/files/service.go` — file listing, trash, search, RootUsage
- `backend/internal/shares/service.go` — share link CRUD
- `backend/internal/storage/sqlite.go` — DB open + schema migration

### Frontend
- `frontend/src/App.tsx` — main app component (2780+ lines)
- `frontend/src/components/Dialogs.tsx` — ConfirmDialog, TextInputDialog, TransferDialog, ToastViewport
- `frontend/src/components/ShareDialog.tsx` — create share link dialog
- `frontend/src/components/ShareManager.tsx` — list/revoke share links
- `frontend/src/components/SettingsPanel.tsx` — settings page/overlay with DB maintenance
- `frontend/src/components/BreadcrumbBar.tsx` — breadcrumb nav with overflow
- `frontend/src/components/FolderPicker.tsx` — destination folder browser

## UI Patterns

- **Views**: `showingTrash`, `showingSettings` flags in App.tsx toggle workspace content (not overlays for page views)
- **Overlays**: ShareDialog, ShareManager, InfoPanel, PreviewModal use `return (<>{shell}<Overlay>...</Overlay></>)` pattern
- **Settings**: renders as a page in the workspace (not overlay) with BreadcrumbBar back navigation
- **Share links**: backend CRUD exists; ShareDialog creates; ShareManager lists/revokes
- **Dialogs**: use `Dialogs.module.css` classes (`dialogButton`, `dialogActions`, etc.)
- **State naming**: `showingTrash`, `showingSettings` for workspace flags; `settingsOpen` for the settings overlay state (used before page conversion but now replaced by `showingSettings`)
- **No shared utils file** — formatting functions (`formatBytes`, `formatUptime`, etc.) are defined locally where needed

## Recent Changes (this session)

### Task 1 — Admin Share Management UI
- Created `frontend/src/components/ShareManager.tsx` + `ShareManager.module.css`
- Lists all shares with path, token, expiry, downloads, status, actions (copy link, delete)
- Accessible via "Manage Shares" button in settings panel

### Task 2 — Observability / Settings Page
- Backend: added `Vacuum()`, `PruneJobs()`, `PruneAuditLogs()` to `jobs.Store`
- Backend: added `POST /api/db/vacuum`, `/prune-jobs`, `/prune-audit-logs` endpoints (admin-only)
- Frontend: extracted settings from inline overlay into `SettingsPanel.tsx` component
- Frontend: SettingsPanel supports `variant="overlay"` (default) and `variant="page"`
- Settings renders as a page in workspace (not overlay) with BreadcrumbBar
- Added: worker status (idle/busy dot), root health warnings (unavailable roots in red), DB maintenance buttons

### Task 4 — Desktop Settings Icon
- Added settings icon to desktop view (This PC) using SVG from assets (`preferences/22/preferences-system.svg`) via `IconImg` + `preferencesIconUrl()` — not Lucide React
- Removed settings gear icon from sidebar header

### Task 3 — Scrollbar Theming
- Global scrollbar rules in `frontend/src/styles/global.css` (WebKit + Firefox via `*` selector)
- Removed per-component scrollbar rules from `App.module.css`

### Task 5 — Batch 1 Bug Audit
- Reviewed all 6 Batch 1 critical bugs in current code
- 5 of 6 were already fixed in prior work; only Bug 1.4 remained
- Fixed Bug 1.4: Added `viewModeBeforeTrash` ref to save/restore `columns` view mode when entering/exiting trash
- Updated `docs/roadmap.md` to mark Batch 1 as complete with per-item status

## Docker

- Use `docker-compose.server.yml` for production/home-server runs (host root access)
- Server compose mounts `/` → `/host` and `/opt/docker/volum` → `/data`
- Running on port 8898 (mapped to container port 8090)
- `.env` file at project root for config (see `.env.example`)

## Icon Convention

- **Desktop icons** (drives, trash, settings, etc.) use SVG files from `frontend/src/assets/` rendered via `IconImg` + a URL function from `frontend/src/api/icons.ts`
- **File/folder icons** use the same asset SVG system via `FileIcon`, `FolderIcon` components
- **UI action icons** (toolbar buttons, context menus) use the Lucide React `Icon` component with string names like `"edit-copy"`, `"view-refresh"`
- **Never use Lucide React for desktop icons or file type icons** — always use the asset SVG system

## Safety Rules

- Never bypass `RootGuard` for filesystem ops
- Never overwrite existing files silently
- Never use direct rename for cross-mount moves
- Never commit `data/`, `storage/`, `frontend/dist/`, `frontend/node_modules/`
- New API endpoints go in `server.go` `routes()`; new job types need registration in `model.go` + `ClaimNext*Job` in `store.go`
- CSS Modules: `styles.className` (camelCase) in components
