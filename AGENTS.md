# Volum Desktop — Agent Memory

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
- Entry: `frontend/src/App.tsx` — main shell with sidebar, workspace, job drawer (~2023 lines)
- API client: `frontend/src/api/client.ts` — typed request functions
- CSS Modules: every component has `*.module.css`, Vite auto-hashes class names. Use `styles.className` (camelCase)
- Shared styles: `frontend/src/styles/global.css` (utility classes), `tokens.css` (theme vars)
- See `frontend/src/` directory structure below

### Frontend Directory Structure
```
frontend/src/
├── App.tsx                          # Main shell (~2023 lines)
├── utils/                           # Shared utilities (NEVER define locally)
│   ├── format.ts, path.ts, archive.ts, jobs.ts, view.ts
├── pages/                           # Full-page views in workspace
│   ├── DesktopView.tsx, FilesView.tsx, TrashView.tsx
│   ├── JobsPage.tsx, SettingsPanel.tsx
├── screens/                         # Full-screen views (outside workspace shell)
│   └── LoginScreen.tsx
├── components/
│   ├── input/                       # Form controls, pickers
│   │   ├── Select.tsx, SortSelect.tsx
│   │   ├── FolderPicker.tsx, BatchRenameModal.tsx
│   ├── overlay/                     # Modals, dialogs, overlays
│   │   ├── Dialogs.tsx              (ConfirmDialog, TextInputDialog, TransferDialog)
│   │   ├── Toast.tsx                (Toast, ToastViewport — extracted from Dialogs)
│   │   ├── InfoPanel.tsx, PreviewModal.tsx
│   │   ├── ShareDialog.tsx, ShareManager.tsx
│   │   └── KeyboardShortcuts.tsx
│   ├── layout/                      # Shell components
│   │   ├── TopBar.tsx, Dock.tsx, StatusBar.tsx
│   │   ├── BreadcrumbBar.tsx, FilesSidebar.tsx
│   └── ui/                          # Generic/reusable UI primitives
│       ├── Icon.tsx, shared.tsx (Overlay, ToolbarButton)
│       ├── EmptyState.tsx, ProgressBar.tsx
│       ├── ThemeToggle.tsx, LogoutButton.tsx
├── styles/       (global.css, tokens.css)
├── api/          (client.ts, icons.ts)
├── assets/       (SVG icons)
```

### Key Files

#### Backend
- `backend/internal/api/server.go` — HTTP routes and handlers
- `backend/internal/jobs/store.go` — SQLite job store + audit logs
- `backend/internal/worker/worker.go` — background job orchestrator
- `backend/internal/security/paths.go` — RootGuard path validation
- `backend/internal/files/service.go` — file listing, trash, search, RootUsage
- `backend/internal/shares/service.go` — share link CRUD
- `backend/internal/storage/sqlite.go` — DB open + schema migration

#### Frontend
- `frontend/src/App.tsx` — main app shell, state, handlers (~2023 lines)
- `frontend/src/components/overlay/Dialogs.tsx` — ConfirmDialog, TextInputDialog, TransferDialog
- `frontend/src/components/overlay/Toast.tsx` — Toast + ToastViewport (separate file)
- `frontend/src/components/overlay/ShareDialog.tsx` — create share link dialog
- `frontend/src/components/overlay/ShareManager.tsx` — list/revoke share links
- `frontend/src/pages/SettingsPanel.tsx` — settings page/overlay with DB maintenance
- `frontend/src/components/layout/BreadcrumbBar.tsx` — breadcrumb nav with overflow
- `frontend/src/components/input/FolderPicker.tsx` — destination folder browser
- `frontend/src/components/ui/EmptyState.tsx` — standardized empty/error state
- `frontend/src/utils/format.ts` — `formatBytes`, `formatUptime`, `formatGridDate`, `formatTrashPath`, `formatDeviceUsage`

## UI Patterns

- **Views**: `showingTrash`, `showingSettings` flags in App.tsx toggle workspace content (not overlays for page views)
- **Overlays**: ShareDialog, ShareManager, InfoPanel, PreviewModal use `return (<>{shell}<Overlay>...</Overlay></>)` pattern
- **Settings**: renders as a page in the workspace (not overlay) with BreadcrumbBar back navigation
- **Share links**: backend CRUD exists; ShareDialog creates; ShareManager lists/revokes
- **Dialogs**: use `Dialogs.module.css` classes (`dialogButton`, `dialogActions`, etc.)
- **State naming**: `showingTrash`, `showingSettings` for workspace flags; `settingsOpen` for the settings overlay state (used before page conversion but now replaced by `showingSettings`)
- **Shared utils** — formatting (`formatBytes`, `formatUptime`, etc.), path ops (`joinPath`, `normalizeFolderPath`), archive helpers, job predicates, and view utilities (`cycleViewMode`, `ViewMode` type) all live in `frontend/src/utils/`. Never define these locally.
- **CSS Modules**: every component has `*.module.css`, Vite auto-hashes class names. Use `styles.className` (camelCase) in components.

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

### Task 7 — Batch A Loading/Error States (all 11 items)
- A.1–A.3 (skeleton/empty states) already implemented
- A.4 (InfoPanel chmod spinner): added `view-refresh` spin animation to "Saving..." button
- A.5 (ShareDialog spinner): added spinning icon to "Creating..." button
- A.6 (BatchRename spinner): added spinning icon to "Renaming..." button
- A.7 (Error banner dismiss) already had `&times;` button
- A.8 (ShareManager error Retry): converted inline style to `styles.retryBtn` CSS class
- A.9 (FolderPicker error Retry) already implemented
- A.10 (Settings error Retry): converted inline style to `styles.retryBtn` CSS class
- A.11 (Desktop error state): added `deviceError` state in App.tsx, error banner + Retry button in DesktopView; extracted `loadDevices` to stable `useCallback`

### Task 8 — Standard EmptyState Component (Batch B prep)
- Added `emptyIconUrl()` to `frontend/src/api/icons.ts` — imports unused `empty.svg` asset
- Enhanced `EmptyState` component: `icon` now optional (defaults to `emptyIconUrl()`), added `compact` prop (48px icon), added `children` slot for extensibility
- Migrated 5 consumers to shared `EmptyState`:
  - `TrashView` (was plain `<div>`) → `EmptyState` with trash icon
  - `DesktopView` partitions (was plain `<div>`) → `EmptyState` with drive icon
  - `JobsPage` (was inline `IconImg` + `h3` + `p`) → `EmptyState` with jobs icon + subtitle
  - `ShareManager` (was `<p>`) → `EmptyState` compact variant (uses default empty.svg icon)
  - `FolderPicker` in `Dialogs.tsx` (was `<div>`) → `EmptyState` compact variant with folder icon
- Removed 8 orphaned CSS blocks: `.emptyState` from TrashView/JobsPage/DesktopView CSS, `.folderPickerEmpty` from Dialogs, `.emptyState` + `.folderEmpty*` from FilesView and App.module.css

### Component Reorganization — Directory Categorization
- Created categorized subdirectories: `pages/`, `screens/`, `components/input/`, `components/overlay/`, `components/layout/`, `components/ui/`
- Moved all 47 component files to their new locations
- Updated App.tsx imports and all test file imports
- Extracted `Toast.tsx` + `Toast.module.css` from `Dialogs.tsx`
- Extracted `FolderPicker.tsx` + `FolderPicker.module.css` from `Dialogs.tsx` (into `components/input/`)
- Simplified `Dialogs.tsx` to only contain ConfirmDialog, TextInputDialog, TransferDialog
- Simplified `Dialogs.module.css` by removing toast and folderPicker CSS classes

### Task 3 — Scrollbar Theming
- Global scrollbar rules in `frontend/src/styles/global.css` (WebKit + Firefox via `*` selector)
- Removed per-component scrollbar rules from `App.module.css`

### Task 5 — Batch 1 Bug Audit
- Reviewed all 6 Batch 1 critical bugs in current code
- 5 of 6 were already fixed in prior work; only Bug 1.4 remained
- Fixed Bug 1.4: Added `viewModeBeforeTrash` ref to save/restore `columns` view mode when entering/exiting trash
- Updated `docs/roadmap.md` to mark Batch 1 as complete with per-item status

### Task 6 — Batch 2 Sidebar Cleanup Audit
- Reviewed all 4 Batch 2 items — all already implemented
- "Storage" → "Removable" (done), USB filter (done), Jobs in Quick Access (done), roots state not in sidebar (done)
- Updated docs to mark Batch 2 complete

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
