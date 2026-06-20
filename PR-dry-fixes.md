# PR: DRY Analysis — Consolidate 24 duplicated code patterns

**Branch:** `dry-fixes`  
**Commits:** 3, **Files:** 44 (+755/-445)

---

## Backend (4 fixes)

| Item | Before | After |
|------|--------|-------|
| `diskUsage()` | 2 thin wrappers around `sysutil.DiskUsage` | Removed, call `sysutil.DiskUsage` directly |
| `validBaseName()` | Wrapper for `security.ValidBaseName` | Removed, call `security.ValidBaseName` directly |
| `time.Now().UTC()` | ~55 inline calls across 9 files | Consolidated into `now()` helper per package |
| `files.Root` struct | Manually copied `security.Root` fields | Embeds `security.Root` |

## Frontend (13 fixes)

### New shared hooks
- **`useAsyncData<T>`** — generic data-fetching hook replaces `useState`+`useCallback`+`useEffect` boilerplate in ShareManager, TrashView, SettingsPanel, useServiceShortcuts
- **`useLongPress`** — long-press detection with configurable `onClick`, `onLongPress`, `delay` — replaces inline ref+setTimeout in FilesView (x2) and DesktopView
- **`useClickOutsideMenus`** — closes all menus on click/resize — replaces inline effects in Home and FilesView
- **`useKeyboardShortcuts`** — key dispatch with input skipping — replaces `?`/`Escape` handlers in Home and FilesView

### New shared components
- **`ErrorBanner`** — renders error message with optional Retry/Dismiss — replaces inline error banners in SearchResultsView, ShareManager, SettingsPanel, TrashView
- **`Skeleton`** — renders configurable count/variant of skeleton placeholders — replaces inline skeleton HTML/CSS in FilesView, SearchResultsView, ShareManager, SettingsPanel

### API consolidation
- `requestVoid` → calls `request<T>` and discards result
- `dbPruneJobs` + `dbPruneAuditLogs` → single `pruneTable(table, olderThan?)`
- `ServiceShortcut` → derived from `ServiceInfo` via `Omit`

## CSS (7 fixes)

- **Global form input base** — `input`, `select`, `textarea` styles centralized in `global.css`; removed duplicates from Dialogs, SettingsPanel, LoginScreen, Select CSS
- **Global focus-visible** — `input:focus`, `button:focus-visible` rules in `global.css`; removed redundant per-component focus rules
- **`@keyframes`** — `spin` and `skeletonPulse` defined once in `global.css` (removed from Dialogs/SearchResultsView CSS)
- **`.spin` class** — uses `var(--anim-spin)` everywhere (SettingsPanel was hardcoding `spin 1s linear infinite`)

## Tests (6 new files, 23 tests)

| File | Tests |
|------|-------|
| `useAsyncData.test.tsx` | load data, error handling, refresh |
| `ErrorBanner.test.tsx` | render message, retry, dismiss |
| `Skeleton.test.tsx` | count, variant, custom dimensions |
| `useLongPress.test.tsx` | mouse/touch long-press, cancel on release/leave |
| `useClickOutsideMenus.test.tsx` | close on click, close on resize, no-op when closed |
| `useKeyboardShortcuts.test.tsx` | key dispatch, non-matching keys, input skipping |

**All 342 tests passing** (36 test files)
