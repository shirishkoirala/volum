# DRY Analysis

Analysis date: 2026-06-14
Scope: `backend/` (Go) and `frontend/src/` (TypeScript/React)

---

## Backend (Go)

### HIGH Severity

#### 1. `nextAvailablePath` — 3 copies, identical algorithm

Stat path → split extension → iterate `i=1..1000` with `"%s (%d)%s"` → return first non-existent.

| File | Lines |
|---|---|
| `backend/internal/api/handlers_jobs.go` | 270–287 |
| `backend/internal/api/handlers_upload.go` | 383–395 |
| `backend/internal/worker/worker.go` | 617–634 |

**Fix:** Extract to `backend/internal/utils/` (or `backend/internal/files/`) package, remove the other 3.

---

#### 2. `pathInside` / `containsPath` — 4 identical implementations

All use `filepath.Rel` + check for `..` prefix. Minor divergence: whether `rel == "."` counts as "inside".

| File | Lines |
|---|---|
| `backend/internal/security/paths.go` | 233–242 |
| `backend/internal/files/service.go` | 561–563 |
| `backend/internal/worker/worker.go` | 646–652 |
| `backend/internal/devices/service.go` | 167–176 |

**Fix:** Export `pathInside` from `security/paths.go`, remove the other 3.

---

#### 3. Job column lists — 4 places, 19 columns each

```sql
SELECT id, type, status, source_path, destination_path,
    total_bytes, processed_bytes, total_items, processed_items,
    current_item, error_message, conflict_policy, verify_mode,
    scheduled_at, next_job_id,
    created_at, updated_at, started_at, completed_at
```

| File | Line(s) |
|---|---|
| `backend/internal/jobs/store.go` | 63–69 (List) |
| `backend/internal/jobs/store.go` | 90–96 (Get) |
| `backend/internal/jobs/store_claiming.go` | 18–22 |
| `backend/internal/jobs/store_items.go` | 157–161 (partial) |

**Fix:** `const jobColumns = \`...\`` at package level.

---

#### 4. Service column list + scan pattern — 2 places, 13 columns

```sql
SELECT id, name, url, COALESCE(icon_url,''), COALESCE(health_url,''),
    COALESCE(description,''), COALESCE(open_mode,'embed'), position,
    created_at, COALESCE(last_health_status,''),
    COALESCE(last_health_checked_at,''), COALESCE(last_health_status_code,0),
    COALESCE(last_health_error,'')
```

| File | Line(s) |
|---|---|
| `backend/internal/desktop/store.go` | 80–81 (ListServices) |
| `backend/internal/desktop/store.go` | 152–153 (UpdateService) |

Plus identical `rows.Scan` + `CreatedAt`/`LastHealthCheckedAt` formatting in both.

**Fix:** `const serviceColumns` + `scanService()` helper.

---

#### 5. Share column list + scan pattern — 2 places, 10 columns

| File | Line(s) |
|---|---|
| `backend/internal/shares/service.go` | 78–79 (List) |
| `backend/internal/shares/service.go` | 117–118 (GetByToken) |

Same `sql.NullString`, `sql.NullInt64`, `enabled int` scan + post-scan conversion.

**Fix:** `const sharesColumns` + `scanShare()` helper.

---

### MEDIUM Severity

#### 6. `RowsAffected == 0 → sql.ErrNoRows` — 10+ places

```go
n, _ := res.RowsAffected()
if n == 0 { return sql.ErrNoRows }
```

| File | Lines |
|---|---|
| `backend/internal/auth/store.go` | 94–97, 113–116, 128–131 |
| `backend/internal/desktop/store.go` | 145–147, 171–172 |
| `backend/internal/jobs/store.go` | 113–117, 136–140, 154–158, 268–274, 289–295 |
| `backend/internal/jobs/store_claiming.go` | 53–58 |

**Fix:** `func requireRowsAffected(result sql.Result) error`.

---

#### 7. `diskUsage()` — 2 nearly identical implementations

Both use `syscall.Statfs_t`, same `Bsize`/`Blocks`/`Bavail`. The `files` version returns `(total, free)`; `devices` returns `(total, free, used)`.

| File | Lines |
|---|---|
| `backend/internal/files/service.go` | 468–477 |
| `backend/internal/devices/service.go` | 178–188 |

**Fix:** Shared `internal/utils/disk.go`.

---

#### 8. `cleanAbs()` — 2 copies

| File | Lines |
|---|---|
| `backend/internal/security/paths.go` | 216–222 |
| `backend/internal/config/config.go` | 137–143 |

**Fix:** Export from `security/paths.go`.

---

#### 9. `validUploadName` / `validBaseName` — overlapping

`validUploadName` is a strict superset of `validBaseName` (adds backslash check).

| File | Lines |
|---|---|
| `backend/internal/files/service.go` | 556–559 |
| `backend/internal/api/handlers_upload.go` | 309–316 |

**Fix:** Make `validUploadName` call `validBaseName` or consolidate.

---

#### 10. WalkDir + cancel/pause + Rel — identical in tar.go and zip.go

Both iterate a source directory checking `IsCancelled`/`IsPaused` and computing `filepath.Rel`.

| File | Lines |
|---|---|
| `backend/internal/worker/tar.go` | 19–68 |
| `backend/internal/worker/zip.go` | 18–71 |

**Fix:** Extract `walkWithCancel(ctx, source, jobID, store, fn)` helper.

---

#### 11. OpenMode validation — 2 copies

```go
if om != "tab" && om != "embed" { om = "embed" }
```

| File | Line |
|---|---|
| `backend/internal/desktop/store.go` | 108–109 (CreateService) |
| `backend/internal/desktop/store.go` | 135–136 (UpdateService) |

**Fix:** `func validOpenMode(mode string) string`.

---

### LOW Severity

#### 12. `scanner` interface — 2 definitions

```go
type scanner interface { Scan(dest ...any) error }
```

| File | Lines |
|---|---|
| `backend/internal/jobs/store.go` | 424–426 |
| `backend/internal/auth/store.go` | 157–159 |

**Fix:** Export from one.

---

#### 13. `time.Now().UTC()` — ~20 calls across store files

Every store method starts with `now := time.Now().UTC()` or inline.

**Fix:** `func now() time.Time { return time.Now().UTC() }`.

---

#### 14. `nullOrString` / `nullOrStringPtr` — identical

```go
func nullOrString(s string) *string
func nullOrStringPtr(s string) *string
```

| File | Lines |
|---|---|
| `backend/internal/shares/service.go` | 162–167 |
| `backend/internal/shares/service.go` | 169–174 |

**Fix:** Delete `nullOrStringPtr` (exact copy).

---

#### 15. `Root` struct — 2 definitions

`security.Root` has 8 fields (no size info). `files.Root` is a superset with `TotalBytes`/`FreeBytes`/`UsedBytes`.

| File | Line |
|---|---|
| `backend/internal/security/paths.go` | 17–26 |
| `backend/internal/files/service.go` | 41–52 |

**Fix:** Embed `security.Root` inside `files.Root`.

---

## Frontend (TypeScript/React)

### HIGH Severity

#### 1. SearchResultsView reimplements ~200 lines of useFileCommands

Handlers for preview, info, download, rename, delete, copy, move, quick-share, archive, extract, checksum, transfer-submit — all duplicated.

| File | Lines |
|---|---|
| `frontend/src/hooks/useFileCommands.ts` | 72–364 |
| `frontend/src/pages/SearchResultsView.tsx` | 126–353 |

**Fix:** Extract a shared `FileActionsProvider` hook/component that accepts an abstraction over selectable items.

---

#### 2. Load-data boilerplate — 5+ occurrences

Every data-fetching pattern: `useState` for data/loading/error + `useCallback` fetcher + `useEffect` to load.

| File | Lines |
|---|---|
| `frontend/src/components/overlay/ShareManager.tsx` | 16–30 |
| `frontend/src/pages/JobsPage.tsx` | 151–154, 172–174 |
| `frontend/src/pages/TrashView.tsx` | 16–30 |
| `frontend/src/pages/SettingsPanel.tsx` | 73–108 |
| `frontend/src/hooks/useServiceShortcuts.ts` | 6–43 |

**Fix:** `useAsyncData<T>(fetcher)` hook returning `{ data, loading, error, refresh }`.

---

#### 3. Error banner + CSS — 2 copies

Same `errorBanner`/`errorDismiss` structure and CSS.

| File | Lines |
|---|---|
| `frontend/src/pages/FilesView.tsx` | 500–505, CSS lines 48–72 |
| `frontend/src/pages/SearchResultsView.tsx` | 395–399, CSS lines 85–111 |

**Fix:** Shared `ErrorBanner` component with its own `.module.css`.

---

### MEDIUM Severity

#### 4. Preview navigation computation — 3 copies

Each computes `previewIndex`, `previewPositionLabel`, `previousPreviewEntry`, `nextPreviewEntry`.

| File | Lines |
|---|---|
| `frontend/src/screens/Home.tsx` | 250–255 |
| `frontend/src/pages/FilesView.tsx` | 341–349 |
| `frontend/src/pages/SearchResultsView.tsx` | 102–106 |

**Fix:** `usePreviewNavigation(entry, entries)` hook.

---

#### 5. Long-press touch handler — 2 copies

Ref + setTimeout pattern for touch long-press detection (~20 lines each).

| File | Lines |
|---|---|
| `frontend/src/pages/FilesView.tsx` | 85, 246–262 |
| `frontend/src/pages/DesktopView.tsx` | 256–283 |

**Fix:** `useLongPress(callback, delay = 500)` hook.

---

#### 6. Close-menus-on-click/resize effect — 2 copies

| File | Lines |
|---|---|
| `frontend/src/screens/Home.tsx` | 306–316 |
| `frontend/src/pages/FilesView.tsx` | 211–223 |

**Fix:** `useClickOutsideMenus(menuStates)` hook.

---

#### 7. `?` key shortcut handler — 2 copies

| File | Lines |
|---|---|
| `frontend/src/screens/Home.tsx` | 297–304 |
| `frontend/src/pages/FilesView.tsx` | 199–209 |

**Fix:** `useKeyboardShortcuts(config)` hook.

---

#### 8. Share URL construction — 3 copies

```typescript
`${window.location.origin}/api/public/${token}`
```

| File | Line |
|---|---|
| `frontend/src/components/overlay/ShareDialog.tsx` | 54 |
| `frontend/src/components/overlay/ShareManager.tsx` | 50 |
| `frontend/src/pages/SearchResultsView.tsx` | 264 |

**Fix:** `buildShareUrl(token)` utility.

---

#### 9. Inline `formatBytes` in InfoPanel — duplicates utils/format.ts

| File | Lines |
|---|---|
| `frontend/src/utils/format.ts` | 12–19 (canonical) |
| `frontend/src/components/overlay/InfoPanel.tsx` | 71–75 (inline duplicate) |

**Fix:** Replace with `formatBytes(entry.size)`.

---

#### 10. `formatDuration` in JobsPage — not extracted to utils

| File | Lines |
|---|---|
| `frontend/src/pages/JobsPage.tsx` | 24–34 |

Overlaps with `formatUptime(seconds)` in `utils/format.ts`.

**Fix:** Merge into `utils/format.ts` as `formatDuration(seconds)`.

---

#### 11. API error handling — 4 copies

Same pattern duplicated in `request`, `requestVoid`, `uploadChunk`, `getUploadStatus`:

```typescript
const body = await response.json().catch(() => ({ error: response.statusText }));
throw new Error(body.error ?? response.statusText);
```

**Fix:** Extract `parseError(response)` helper.

---

#### 12. `request` / `requestVoid` — 90% identical

| File | Lines |
|---|---|
| `frontend/src/api/client.ts` | 146–159 (request) |
| `frontend/src/api/client.ts` | 160–170 (requestVoid) |

**Fix:** `requestVoid` calls `request` and discards result.

---

#### 13. `dbPruneJobs` / `dbPruneAuditLogs` — identical parameter construction

| File | Lines |
|---|---|
| `frontend/src/api/client.ts` | 513–516 |
| `frontend/src/api/client.ts` | 518–521 |

**Fix:** `pruneTable(endpoint, olderThan?)` helper.

---

#### 14. `createService` / `updateService` — nearly identical body construction

| File | Lines |
|---|---|
| `frontend/src/api/client.ts` | 579–585 |
| `frontend/src/api/client.ts` | 586–593 |

**Fix:** Shared `serviceBody()` builder.

---

#### 15. `ServiceShortcut` / `ServiceInfo` — near-identical types

| File | Lines |
|---|---|
| `frontend/src/utils/services.ts` | 1–13 |
| `frontend/src/api/client.ts` | 523–536 |

Same for `ServiceHealthResult`.

| File | Lines |
|---|---|
| `frontend/src/utils/services.ts` | 17–23 |
| `frontend/src/api/client.ts` | 538–544 |

**Fix:** Derive `ServiceShortcut` from `ServiceInfo`, define `ServiceHealthResult` once.

---

#### 16. `ClipboardState` — 2 definitions

```typescript
type ClipboardState = { mode: 'copy' | 'move'; entries: FileEntry[] } | null;
```

| File | Line |
|---|---|
| `frontend/src/hooks/useFileActions.ts` | 5 |
| `frontend/src/hooks/useFileCommands.ts` | 17 |

**Fix:** Export from one file.

---

#### 17. `RunAction` — 2 definitions

```typescript
type RunAction = (action: () => Promise<unknown>, successTitle?: string) => Promise<void>;
```

| File | Line |
|---|---|
| `frontend/src/hooks/useArchiveCommands.ts` | 9 |
| `frontend/src/hooks/useUploadCommands.ts` | 7 |

**Fix:** Export from `useFileCommands.ts`.

---

### CSS Violations

| # | Issue | Files | Fix |
|---|---|---|---|
| 1 | `@keyframes spin` in 2 places | `global.css`, `Dialogs.module.css` | Remove from Dialogs, use global var |
| 2 | `@keyframes skeletonPulse` in 2 places | `global.css`, `SearchResultsView.module.css` | Remove from SearchResultsView |
| 3 | `.spin` class missing from `shared.module.css`, only in `SettingsPanel.module.css` | 4 components reference `uiStyles.spin` | Add `.spin` to `shared.module.css` |
| 4 | Error banner CSS duplicated | `FilesView.module.css`, `SearchResultsView.module.css` | Shared `ErrorBanner` component |
| 5 | Skeleton CSS duplicated (3 variants) | `FilesView.module.css`, `SearchResultsView.module.css`, `ShareManager.module.css` | Shared `Skeleton` primitive |
| 6 | `@media (max-width: 760px)` in 12+ files | Nearly every `.module.css` | CSS custom media query or PostCSS plugin |
| 7 | Form input styling (3 variants) | `Dialogs.module.css`, `SettingsPanel.module.css` | Shared input CSS with style variants |
| 8 | Focus styles duplicated | `SettingsPanel.module.css` (3 places) | Global `input:focus` rule |
| 9 | Skeleton animation vars not used | `FilesView.module.css`, `ShareManager.module.css` | Use `var(--anim-skeleton)` |

### Component / Behavioral Violations

| # | Issue | Files | Fix |
|---|---|---|---|
| 1 | Preview modal wrapper pattern | `Home.tsx`, `FilesView.tsx`, `SearchResultsView.tsx` | Consolidate preview rendering |
| 2 | ShareDialog wrapper pattern | `Home.tsx`, `FilesView.tsx`, `SearchResultsView.tsx` | Shared overlay provider |
| 3 | TransferDialog wrapper pattern | Same 3 files | Same |
| 4 | Maintenance handlers (vacuum/prune) | `SettingsPanel.tsx` (3 handlers) | `runMaintenance()` helper |
| 5 | User management handlers | `SettingsPanel.tsx` (4 handlers) | `withUserFeedback()` helper |
| 6 | Archive/extract/checksum dialog pattern | `useArchiveCommands.ts` (3 functions) | Minor — structurally similar but distinct params |
| 7 | Spinner button pattern (Creating/Saving/Renaming) | 5 files | `Button` `loading` variant |
| 8 | `can*` capability computation | `useSelection.ts`, `SearchResultsView.tsx` | `useCapabilities()` hook |
| 9 | `isMobile` branching in every opener | `useWorkspaceOpeners.ts` (8 branches) | Strategy pattern |
| 10 | TrashView reimplements its own selection system | `TrashView.tsx` vs `useSelection.ts` | Use `useSelection` hook |
| 11 | TrashView has own restore/delete/empty handler | `TrashView.tsx` vs `useFileCommands.ts` | Share trash action handlers |

---

## Recommended Top 5

1. **Backend:** `nextAvailablePath` + `pathInside` consolidation (eliminates 5 redundant implementations)
2. **Frontend:** `useAsyncData<T>` hook + `ErrorBanner` component (~250 lines of boilerplate eliminated)
3. **Backend:** Job/service/share column constants + scan helpers (prevents schema drift)
4. **Frontend:** `usePreviewNavigation` + `useLongPress` + `useKeyboardShortcuts` hooks
5. **CSS:** Shared primitives for `.spin`, skeletons, form inputs, and error banners
