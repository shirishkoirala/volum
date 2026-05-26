# Volum Desktop — Codebase Refactoring Roadmap

## Phase 1 — Quick Wins (Safe deletions, small fixes)

| # | Task | Status |
|---|---|---|
| 1.1 | Delete dead files: `SortSelect.tsx`, `LogoutButton.tsx` | |
| 1.2 | Delete dead exports: `cycleViewMode()`, `formatTrashPath()` | |
| 1.3 | Delete dead code: `sseConnected = true` constant in Home.tsx | |
| 1.4 | Delete dead `migrations/001_init.sql` — out of sync with schema | |
| 1.5 | Move `typescript` + `@vitejs/plugin-react` from `dependencies` → `devDependencies` | |
| 1.6 | Add `"typecheck"` script to `package.json` (`tsc --noEmit`) | |
| 1.7 | Fix `docker-compose.server.yml` — wire all env vars to `.env` instead of hardcoding | |
| 1.8 | Fix 3 compose files — use shared `.env` reference pattern | |
| 1.9 | Remove `SelectionToolbar.tsx` and `DualPaneView.tsx` from AGENTS.md | |

## Phase 2 — Type & API Deduplication

| # | Task | Status |
|---|---|---|
| 2.1 | Add `isPreviewableFile(name)` to `utils/` — dedup 5 identical checks | |
| 2.2 | Extract shared types (`SortField`, `SortDirection`, `RenameState`, `ContextMenuState`) to `types/` | |
| 2.3 | Remove `UploadResponse` alias — reuse `JobsResponse` | |
| 2.4 | Extract `resetToDesktopView()` helper — dedup 5 identical state-reset blocks in Home.tsx | |
| 2.5 | Extract `openFileExternally(path)` helper — dedup 5 `window.open(downloadUrl)` calls | |
| 2.6 | Extract `useLocalStorage<T>(key, defaultValue)` generic hook — replaces 9 manual sync `useEffect` calls | |

## Phase 3 — CSS Cleanup

| # | Task | Status |
|---|---|---|
| 3.1 | Move `@keyframes skeletonPulse` (3 duplicates) and `@keyframes spin` (2 duplicates) to `global.css` | |
| 3.2 | Audit and remove unused CSS classes across all `.module.css` files | |
| 3.3 | Consider utility classes for repeated patterns (112 `display:flex`, 87 `border-radius`, etc.) | |

## Phase 4 — Custom Hooks Extraction (Home.tsx → 1021 → ~300 lines)

| # | Task | Status |
|---|---|---|
| 4.1 | Extract `useViewPreferences()` — `viewMode`, `sortField`, `sortDirection`, `showHidden`, `folderPrefs`, `currentPath` + localStorage sync | |
| 4.2 | Extract `useNavigation()` — `showingTrash`, `showingSettings`, `showingJobs`, `showingMyPC`, `selectedDriveName` | |
| 4.3 | Extract `useFavorites()` — `favorites` + `addFavorite`/`removeFavorite`/`persistFavorites` + localStorage | |
| 4.4 | Extract `useWallpaper()` — wallpaper state + localStorage | |
| 4.5 | Extract `useFileActions()` — preview, info, rename, batch rename, analyze, search, context menu state | |
| 4.6 | Add `useCallback` to 15 handlers passed as props to children | |

## Phase 5 — Component Decomposition (Monster Files)

| # | Task | Status |
|---|---|---|
| 5.1 | **FilesView** (360 lines, 57 props) — extract sub-components: `FileSearchBar`, `FileGridView`, `FileListView`, `FileColumnView` | |
| 5.2 | **FileContextMenu** (37 props) — collapse 20 `can*` booleans into single `capabilities` object | |
| 5.3 | **DesktopView** (421 lines) — extract `DriveCard` component (internal/external are copy-pasted) | |
| 5.4 | **SettingsPanel** (352 lines) — extract `WallpaperPicker` sub-component, `ServerInfo` sub-component | |
| 5.5 | Extract `useDialogStack()` — manages `confirmDialog`, `textInputDialog`, `transferDialog`, etc. | |

## Phase 6 — Backend: Split Monolithic Files

| # | Task | Status |
|---|---|---|
| 6.1 | **`api/server.go`** (1329 lines) → split into `handlers_files.go`, `handlers_jobs.go`, `handlers_shares.go`, `handlers_trash.go`, `handlers_db.go`, `middleware.go` | |
| 6.2 | **`files/service.go`** (789 lines) → split into `service_list.go`, `service_trash.go`, `service_disk.go` | |
| 6.3 | **`jobs/store.go`** (770 lines) → split into `store_jobs.go`, `store_items.go`, `store_audit.go`, `store_claiming.go`, `store_maintenance.go` | |
| 6.4 | **`config/config.go`** — extract mount discovery to `config/mounts.go` | |
| 6.5 | Move `ArchiveFormat()` from `worker/worker.go` to `worker/format.go` — breaks api→worker import coupling | |

## Phase 7 — Backend: Error Handling & Quality

| # | Task | Status |
|---|---|---|
| 7.1 | Fix `writeJSON()` swallowing all encoding errors — at minimum log them | ✓ |
| 7.2 | Fix `archivePath, _ = nextAvailablePath(dest)` in worker — error is silently discarded | ✓ |
| 7.3 | Check migration errors properly — only ignore "duplicate column", fail on others | ✓ |
| 7.4 | Wrap `ClearCompleted`/`ClearFailed`/`PruneJobs` in transactions | ✓ |
| 7.5 | Add pagination to `jobs.List()` — replace hardcoded `LIMIT 200` | ✓ |
| 7.6 | Set `SetMaxOpenConns(1)` for SQLite — prevents "database is locked" | ✓ |

## Phase 8 — Testing

| # | Task | Status |
|---|---|---|
| 8.1 | Add tests for `auth` package — login, session verification, HMAC signing | ✓ |
| 8.2 | Add tests for `shares` package — Create, List, GetByToken, Delete | ✓ |
| 8.3 | Add tests for `storage` package — DB open, migration, schema validation | ✓ |
| 8.4 | Add lint + test steps to Dockerfile | ✓ |

## Phase 9 — Architecture

| # | Task | Status |
|---|---|---|
| 9.1 | Normalize API routes to RESTful conventions (5 job creation endpoints → single `POST /api/jobs`) | ✓ |
| 9.2 | Consider OpenAPI/Swagger spec for backend ↔ frontend type sync | ✚ |
| 9.3 | Enable stricter TypeScript options (`noUncheckedIndexedAccess`, `noUnusedLocals`) | ✓ |
| 9.4 | Add shared CSS utility classes to reduce `.module.css` duplication | ✓ |

---

## Execution Order

```
Phase 1 (Quick Wins) → Phase 2 (Dedup) → Phase 3 (CSS)
→ Phase 4 (Hooks) → Phase 5 (Components) → Phase 6 (Backend)
→ Phase 7 (Error Handling) → Phase 8 (Testing) → Phase 9 (Architecture)
```
