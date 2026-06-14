# Volum Desktop — Agent Memory

## Build & Run

- **Production build**: `docker compose -f docker-compose.server.yml up --build -d`
- **Dev server**: always use Docker dev (`docker compose -f docker-compose.dev.yml up --build`) instead of local `npm run dev` unless explicitly requested otherwise
- **Tests/checks**: always run verification through Docker when possible; use local frontend commands only as a fallback and call that out
- **Frontend fallback typecheck**: `cd frontend && npx tsc --noEmit`
- **Frontend fallback lint**: `cd frontend && npm run lint`
- **Frontend fallback build**: `cd frontend && npm run build`
- **Must lint + type-check after every change before running the server**
- **Go is NOT installed locally** — always verify backend via Docker build

## Architecture

### Backend (`backend/`)
- Go + chi router + SQLite (via mattn/go-sqlite3)
- Entry: `backend/cmd/volum/main.go`
- Routes: `backend/internal/api/server.go` — `routes()` method registers all endpoints
- Auth: HMAC-signed session cookies, admin/readonly roles
- All filesystem ops validated through `RootGuard.Resolve` (no raw path access)
- Move = copy + verify + delete (never direct rename across mounts)
- Job store: `backend/internal/jobs/store.go` (split across 5 files: `store.go`, `store_claiming.go`, `store_items.go`, `store_audit.go`, `store_maintenance.go`)
- Worker: `backend/internal/worker/worker.go` — polls every 1s for new jobs
- SSE: pushes full job list every 1s; frontend diffs via refs

### Frontend (`frontend/`)
- React 19 + Vite + TypeScript
- Entry: `frontend/src/App.tsx` — thin routing shell (auth gate vs Home, ~50 lines)
- API client: `frontend/src/api/client.ts` — typed request functions
- CSS Modules: every component has `*.module.css`, Vite auto-hashes class names. Use `styles.className` (camelCase)
- Shared styles: `frontend/src/styles/global.css` (utility classes), `tokens.css` (theme vars)
- See `frontend/src/` directory structure below

### Frontend Directory Structure
```
frontend/src/
├── App.tsx                          # Thin routing shell (~30 lines)
├── screens/
│   ├── Home.tsx                     # Workspace screen (state, effects, handlers, shell)
│   └── LoginScreen.tsx
├── hooks/                           # Custom hooks (NOT pure utils)
│   ├── useJobs.ts, useDragDrop.ts, useRubberBand.ts
├── utils/                           # Shared utilities (NEVER define locally)
│   ├── format.ts, path.ts, archive.ts, jobs.ts, view.ts
├── pages/                           # Full-page views in workspace
│   ├── DesktopView.tsx, FilesView.tsx, TrashView.tsx
│   ├── JobsPage.tsx, SettingsPanel.tsx
├── screens/                         # Full-screen views (outside workspace shell)
│   └── LoginScreen.tsx
├── components/
│   ├── input/                       # Form controls, pickers
│   │   ├── Select.tsx
│   │   ├── FolderPicker.tsx, BatchRenameModal.tsx
│   ├── overlay/                     # Modals, dialogs, overlays
│   │   ├── Dialogs.tsx              (ConfirmDialog, TextInputDialog, TransferDialog)
│   │   ├── Toast.tsx                (Toast, ToastViewport — extracted from Dialogs)
│   │   ├── InfoPanel.tsx, PreviewModal.tsx
│   │   ├── ShareDialog.tsx, ShareManager.tsx
│   │   └── KeyboardShortcuts.tsx
│   ├── layout/                      # Shell components
│   │   ├── TopBar.tsx, Dock.tsx, StatusBar.tsx
│   │   ├── BreadcrumbBar.tsx
│   └── ui/                          # Generic/reusable UI primitives
│       ├── Icon.tsx, shared.tsx (Overlay, ToolbarButton)
│       ├── EmptyState.tsx, ProgressBar.tsx
│       ├── ThemeToggle.tsx
├── styles/       (global.css, tokens.css)
├── api/          (client.ts, icons.ts)
├── assets/       (SVG icons)
```

### Key Files

#### Backend
- `backend/internal/api/server.go` — HTTP routes and handlers
- `backend/internal/jobs/store.go` — SQLite job store (split across 5 files: `store.go`, `store_claiming.go`, `store_items.go`, `store_audit.go`, `store_maintenance.go`)
- `backend/internal/worker/worker.go` — background job orchestrator
- `backend/internal/security/paths.go` — RootGuard path validation
- `backend/internal/files/service.go` — file listing, trash, search, RootUsage
- `backend/internal/shares/service.go` — share link CRUD
- `backend/internal/storage/sqlite.go` — DB open + schema migration

#### Frontend
- `frontend/src/App.tsx` — thin routing shell (auth gate vs Home, ~50 lines)
- `frontend/src/screens/Home.tsx` — workspace state, effects, handlers, shell rendering
- `frontend/src/components/overlay/Dialogs.tsx` — ConfirmDialog, TextInputDialog, TransferDialog
- `frontend/src/components/overlay/Toast.tsx` — Toast + ToastViewport (separate file)
- `frontend/src/components/overlay/ShareDialog.tsx` — create share link dialog
- `frontend/src/components/overlay/ShareManager.tsx` — list/revoke share links
- `frontend/src/pages/SettingsPanel.tsx` — settings page/overlay with DB maintenance
- `frontend/src/components/layout/BreadcrumbBar.tsx` — breadcrumb nav with overflow
- `frontend/src/components/input/FolderPicker.tsx` — destination folder browser
- `frontend/src/components/ui/EmptyState.tsx` — standardized empty/error state
- `frontend/src/utils/format.ts` — `formatBytes`, `formatUptime`, `formatGridDate`, `formatDeviceUsage`

## UI Patterns

- **Views**: `showingTrash`, `showingSettings` flags in Home.tsx toggle workspace content (not overlays for page views)
- **Overlays**: ShareDialog, ShareManager, InfoPanel, PreviewModal use `return (<>{shell}<Overlay>...</Overlay></>)` pattern
- **Settings**: renders as a page in the workspace (not overlay)
- **Share links**: backend CRUD exists; ShareDialog creates; ShareManager lists/revokes
- **Dialogs**: use `Dialogs.module.css` classes (`dialogButton`, `dialogActions`, etc.)
- **State naming**: `showingTrash`, `showingSettings` for workspace flags; `settingsOpen` for the settings overlay state (used before page conversion but now replaced by `showingSettings`)
- **Shared utils** — formatting (`formatBytes`, `formatUptime`, etc.), path ops (`joinPath`, `normalizeFolderPath`), archive helpers, job predicates, and view utilities (`ViewMode` type) all live in `frontend/src/utils/`. Never define these locally.
- **CSS Modules**: every component has `*.module.css`, Vite auto-hashes class names. Use `styles.className` (camelCase) in components.

## Recent Changes (this session)

### Task 9 — Trash & Jobs Header Removal
- Removed both toolbar headers (selection bar + sort bar) from TrashView — users cannot bulk-restore, bulk-delete, select-all, invert-select, change view mode, sort, or refresh trash
- Removed filter tabs header from JobsPage — users cannot filter by All/Active/Completed/Failed
- Removed jobFilter/setJobFilter state from Home.tsx
- Removed variant system from SettingsPanel entirely (always page, no overlay)
- Removed BreadcrumbBar from SettingsPanel, TrashView, and JobsPage
- Removed BreadcrumbBar import and usage from all 3 pages; removed onClose props where applicable
- Cleaned up TrashView props in Home.tsx (removed 12 unused props)
- Added proper TrashViewProps type definition
- Removed orphaned CSS from TrashView.module.css (.topbar, .sortSelect, .selectionBar, .selectionActions, .trashGrid, .trashItemRow, .trashItemInfo, .fileList) and JobsPage.module.css (.filterBar, .filterTab, .filterTab:hover, .filterTab.active)
- All changes type-checked clean with `npx tsc --noEmit`

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
- A.11 (Desktop error state): added `deviceError` state in Home.tsx, error banner + Retry button in DesktopView; extracted `loadDevices` to stable `useCallback`

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

### Home Screen Extraction — App.tsx slimming (2032→31 lines, -98%)
- Created `screens/Home.tsx` — absorbs all workspace state, effects, handlers, shell JSX, and overlay rendering
- Rewrote `App.tsx` as a thin routing shell: theme management, session/auth gate, LoginScreen vs Home
- Created `hooks/useJobs.ts` — SSE job subscription + job control handlers (cancel/retry/pause/resume)
- Created `hooks/useDragDrop.ts` — drag/drop state and handlers for file transfers
- Created `hooks/useRubberBand.ts` — rubber-band selection logic

- Created `components/overlay/FileContextMenu.tsx` + `TrashContextMenu.tsx` — context menu components with `ContextMenu.module.css`
- Removed orphaned CSS: `.topbar`, `.selectionBar`, `.selectionActions`, `.contextMenu` from App.module.css (now in ContextMenu modules)
- App.module.css reduced from 116→9 lines (.authShell only)
- Home.module.css created with `.appShell` + `.workspace` grid layout

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
- New API endpoints go in `server.go` `routes()`; new job types need registration in `model.go` + `ClaimNext*Job` in `store_claiming.go`
- CSS Modules: `styles.className` (camelCase) in components

## Guiding Principles

- **KISS** — straightforward solutions, no over-engineering
- **YAGNI** — implement only what's currently needed, no speculative features
- **SOLID** — single responsibility, open-closed, interface segregation, dependency inversion

## Product Roadmap

- Roadmap lives in `docs/roadmap.md`; README links to it from the Development section.
- Current priority order: large-folder performance, preview window polish, search-result actions, conflict handling, upload reliability, mobile/responsive desktop, service health/notifications, then service widgets/integrations.
- Keep Volum focused on reliable file management with desktop-style service shortcuts; avoid turning it into a full monitoring suite or dashboard widget platform too early.

## Task History

### Service Health Checks
- Added optional `healthUrl` to desktop services in SQLite, backend store, API request/response types, and frontend service shortcut types.
- Added `GET /api/services/health` authenticated endpoint; backend checks only services with a health URL, uses a 3s timeout, and limits concurrent checks.
- Service form now includes optional "Health Check URL"; invalid values are rejected client-side.
- Desktop service icons show a small checking/healthy/unhealthy indicator when `healthUrl` is configured.
- Frontend health polling is visibility-aware and desktop-view-aware, refreshing immediately when useful and then every 60s only while visible on the desktop.
- Tests cover backend health endpoint/store migration and frontend service form/desktop health indicator behavior.

### Roadmap From Adjacent App Requests
- Added `docs/roadmap.md` based on recurring File Browser, Homarr, and Homepage requests.
- Prioritized practical Volum work: large-folder performance, preview preservation/cancellation, search-result actions, duplicate handling, upload hardening, mobile layout, and constrained health/notification features.
- Explicitly deferred full monitoring, native mobile apps, plugin marketplace, multi-board dashboard editor, and service-specific widget catalog.

### Priority 1 — Large Folder Performance, Slice 1
- Added `useIncrementalEntries` to cap large folder initial rendering at 240 entries and load 240-entry batches on near-bottom scroll or "Load more".
- Wired incremental rendering into both `FileGridView` and `FileListView`.
- Added a large-folder banner showing rendered count vs total count.
- Converted selected/favorite path checks inside file rendering to `Set` lookups.
- Browser smoke test used a temporary 720-file folder under `storage/` and confirmed 240 initial items, then 480 after loading more.

### Task 10 — Sidebar Removed, Favorites → Desktop Icons
- Deleted `FilesSidebar.tsx` and `FilesSidebar.module.css`
- Removed sidebar rendering (overlay + normal) from FilesView.tsx
- Removed `sidebarOpen`/`isMobile` state, resize/escape listeners, mobile sidebar button
- Removed sidebar-only props from FilesViewProps: `devices`, `recentPaths`, `subdirs`, `sectionCollapsed`, `onToggleSection`, `onRemoveFavorite`
- Removed `recentPaths` state, `pushRecent` handler, `sectionCollapsed` state, `subdirs` useMemo from Home.tsx
- Removed orphaned CSS (`.topbar`, `.sortSelect`, `.sidebarOverlay`, `.sidebarOverlayHeader`, `.sidebarOverlayTitle`, `.sidebarBackdrop`, `.sidebarNormal`) from FilesView.module.css
- Added `favorites` to DesktopViewProps — favorited folders now appear as desktop icons with folder SVG, drag-reorderable alongside My PC/Trash/Settings/Jobs
- Kept `favorites` state, `addFavorite`/`removeFavorite`/`persistFavorites` handlers in Home.tsx
- Kept bookmark toggle button in FilesView toolbar (now says "Add to desktop" / "Remove from desktop")
- Kept pinBadge indicator on favorited folders in file grid
- Repurposed FileContextMenu text: "Pin to sidebar" → "Add to desktop", "Unpin from sidebar" → "Remove from desktop"
- Updated `folderSuggestions` to drop `favorites`/`recentPaths`
- Updated `handleDockActivate` files fallback to `roots.find` only (no `favorites[0]`)
- TypeScript + ESLint + Docker build verified

### E.5 — Desktop Wallpaper
- Created `frontend/src/utils/wallpaper.ts` — `WallpaperConfig` type, `loadWallpaper`/`saveWallpaper` localStorage helpers, `wallpaperToStyle` CSS conversion, 16 preset colors + 6 gradients
- Added `wallpaperStyle` prop to `DesktopView` — wraps content in `.desktopWrapper` div with background style
- Added "Desktop" category in `SettingsPanel` with: Default button, 16 color swatches, custom color picker (native `<input type="color">`), 6 gradient presets
- State managed in Home.tsx, persisted to localStorage under `volum_wallpaper`
- TypeScript + Docker build verified

### Phase 6 — Backend Splitting
- **6.1** Split `api/server.go` (1329 lines) into 8 focused files: `handlers_auth.go`, `handlers_files.go`, `handlers_trash.go`, `handlers_upload.go`, `handlers_jobs.go`, `handlers_shares.go`, `handlers_db.go`, `middleware.go`
- **6.2** Split `files/service.go` (789 lines) into `service.go`, `service_trash.go`, `service_disk.go`
- **6.3** Split `jobs/store.go` (770 lines) into `store.go` (core job CRUD), `store_claiming.go` (ClaimNext*), `store_items.go` (item CRUD), `store_audit.go` (audit logging), `store_maintenance.go` (vacuum/prune)
- **6.4** Extracted mount discovery from `config/config.go` → `config/mounts.go`
- **6.5** Already done — `ArchiveFormat()` lives in `worker/tar.go`
- All builds (Go + Docker) verified passing

### Phase 7 — Backend: Error Handling & Quality
- **7.1** `writeJSON()` now logs encoding errors via `slog.Error`
- **7.2** `archivePath` error from `nextAvailablePath` is now properly returned instead of discarded
- **7.3** Migration `ALTER TABLE` errors are now checked — only `"duplicate column"` is silently ignored
- **7.4** `ClearCompleted`, `ClearFailed`, `PruneJobs` all wrapped in SQL transactions
- **7.5** `jobs.List()` now accepts `(ctx, limit, offset)` — REST handler parses `?limit=&offset=`, SSE uses defaults (200, 0)
- **7.6** SQLite connection pool limited to `SetMaxOpenConns(1)` — prevents "database is locked"
- Docker build + server start verified

### Phase 8 — Testing
- **8.1** 15 tests for auth package (login, session, HMAC, context round-trip)
- **8.2** 9 tests for shares package (create, list, getByToken, delete, full flow)
- **8.3** 8 tests for storage package (open, migrate, addColumn, maxOpenConns)
- **8.4** Added `go vet + go test` steps to Dockerfile (run on every build)

### Phase 9 — Architecture
- **9.1** Consolidated 5 job-creation endpoints (`POST /api/jobs/{type}`) into single `POST /api/jobs` with `type` field in body; merged extract/checksum validation into unified handler
- **9.3** Enabled `noUncheckedIndexedAccess` and `noUnusedLocals` in `tsconfig.json`; fixed 40+ strictness errors across all frontend files
- **9.4** Added CSS utility classes to `global.css` (`.row`, `.col`, `.gap*`, `.truncate`, `.clickable`, flex helpers, alignment, color utilities)
- **9.2** (recommendation) OpenAPI/Swagger would improve backend↔frontend type sync but deferred — existing TypeScript types in `client.ts` are already well-maintained

### Session — Columns Removal, Container Styling, Drives View Extraction
- **Columns removed**: Deleted `FileColumnView.tsx` + `FileColumnView.module.css`; removed `'columns'` from `ViewMode` type; deleted `buildColumnPath` utility; cleaned columns branch from `FilesView.tsx`; removed `viewModeBeforeTrash` ref; removed "Columns" menu item from `AppMenuBar.tsx`; removed `'view-columns': Columns3` icon mapping; cleared columns assertion from test
- **Container styling**: Added `border: 1px solid var(--color-border-subtle)` + `border-radius: var(--radius-md)` + `margin: var(--space-md)` to both `.fileList` (FileListView.module.css) and `.fileGrid` (FileGridView.module.css) — no background
- **Skeleton styling**: Updated `.skeletonGrid` (FilesView.module.css) to match — `border`, `border-radius`, `margin: var(--space-md)`, `padding: var(--space-lg)`
- **Drives extraction**: Created `DrivesView.tsx` + `DrivesView.module.css` — extracted partition grid (Mode 1) and drive list (Mode 2) from `DesktopView.tsx` into own component with bordered container (`border`, `border-radius`, `margin`, `padding` — matches fileList/fileGrid pattern)
- **ActiveView**: Added `'drives'` to `ActiveView` type in `useNavigation.ts`, `TopBar.tsx`, and `StatusBar.tsx`; excluded `'drives'` from `showStatusBar`
- **DesktopView simplified**: Removed 8 props (`devices`, `selectedDriveName`, `onSelectDrive`, `showingMyPC`, `onShowMyPC`, `deviceError`, `onRetryDevices`, `driveIconUrl`); removed all drives code, device error handling, BreadcrumbBar, DriveSection, ProgressBar, EmptyState imports
- **DesktopView.module.css**: Removed `.driveContents`, `.driveContent`, `.drivePartitionItem`, `.drivePartitionInfo`, `.drivePartitionMeter`, `.partitionUnmoved` and their hover/media styles — kept only desktop icon CSS
- **Home.tsx**: Renders `DrivesView` when `activeView === 'drives'`; passes `handleBackToDesktop` (sets `showingMyPC = false`)
- TypeScript, ESLint, and production build (`npm run build`) all pass clean
