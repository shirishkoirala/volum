# Volum Cleanup Roadmap

This roadmap tracks the current inconsistency, KISS, YAGNI, and SOLID cleanup work. Fix correctness first, then reduce coupling, then polish conventions.

## Phase 1 - Correctness

### 1.1 Fix checksum job scheduling — ✅ Complete

**Result:**
- `runOnce` chain: transfer → archive/extract → checksum. Checksum claims when no transfer/archive job exists.
- `TestRunOnceProcessesChecksumWhenNoArchiveJob` — checksum-only jobs are picked up.
- `TestRunOnceProcessesOnlyOneJobPerTick` — archive takes priority, checksum runs on next tick.

### 1.2 Complete directory checksum jobs — ✅ Complete

**Result:**
- `checksumDir` calls `CompleteJob` after the second walkDir succeeds (line 152).
- Cancellation returns nil without `CompleteJob`; pause returns `errJobPaused`.
- `TestProcessChecksumDirectoryCompletesJob` + `TestProcessChecksumDirectoryEmptyCompletesJob` verify completion.

## Phase 2 - Frontend State Ownership

### 2.1 Deduplicate view preference persistence — ✅ Complete

**Result:**
- `useViewPreferences` is the single owner of folder preference persistence via `navigateToPath`.
- Home.tsx has zero direct `setFolderPrefs`/`folderPrefs` calls.
- Per-folder view, sort field, and sort direction restored on navigation.
- Trash `columns` restore via `viewModeBeforeTrash` ref works correctly.

### 2.2 Split `Home` by workflow, not state buckets

**Problem:** `Home.tsx` remains over 1,100 lines and owns navigation, file commands, selection, search, desktop actions, dialogs, and rendering.

**Files:**
- `frontend/src/screens/Home.tsx`
- `frontend/src/hooks/useFileActions.ts`
- `frontend/src/hooks/useDialogStack.ts`
- New focused hooks/components as needed

**Plan:**
- Replace state-bucket hooks with behavior-focused hooks.
- Candidate hooks:
  - `useFileBrowser` for loading entries, search, navigation, and folder preferences.
  - `useSelection` for file/trash selection operations.
  - `useFileCommands` for create, rename, delete, archive, extract, checksum, transfer, share.
  - `useToasts` for toast creation/dismissal.
- Keep `Home` responsible for composition only.

**Acceptance:**
- `Home.tsx` becomes materially smaller and mostly wires screen components together.
- Hooks expose behavior, not raw unrelated setters.
- Existing file operations still work through the same UI paths.

## Phase 3 - Component Boundaries

### 3.1 Reduce `FilesView` prop surface — ✅ Complete

**Result:**
- Removed 3 unused props: `entries`, `contextMenu`, `onCloseContextMenu`
- Grouped remaining 30+ props into 7 cohesive objects: `navigation`, `search`, `selection`, `dragDrop`, `rename`, `context`, `loadError`, `touch`
- `FilesViewProps` shrunk from 40+ flat props to 15 top-level keys (8 groups + 5 standalone)
- Home.tsx FilesView JSX fully migrated to grouped props

### 3.2 Extract shared context menu shell — ✅ Complete

**Result:**
- Created `ContextMenuShell.tsx` — handles x/y positioning, focus trap, keyboard nav, Escape, click-outside, role="menu", aria-orientation
- Migrated 6 context menus: FileContextMenu, DesktopContextMenu, TrashContextMenu, FilesEmptyMenu, JobsEmptyMenu, TrashEmptyMenu
- Each menu reduced to ~20-40 lines of item list JSX only
- All menus retain identical keyboard and mouse behavior

## Phase 4 - API And Utility Separation

### 4.1 Split API types, endpoint functions, and file predicates — ✅ Complete

**Result:**
- Created `utils/fileTypes.ts` with `isImageExtension`, `isVideoExtension`, `isAudioExtension`, `isTextExtension`
- `client.ts` no longer exports file-type predicates
- `preview.ts`, `PreviewModal.tsx`, `FileItem.tsx` all import from `utils/fileTypes.ts` instead of `api/client.ts`
- No behavior change in preview/download flows

### 4.2 Tighten job type modeling — ✅ Complete

**Result:**
- Added `JobType` (`'copy' | 'move' | 'upload' | 'extract' | 'archive' | 'checksum'`) and `JobStatus` (`'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'needs_attention'`) union types
- `Job.type` and `Job.status` use the union types; `createJob` accepts `JobType`
- `JobsPage.tsx` helper signatures use `JobStatus`
- Unknown statuses/values from API are handled gracefully at runtime (strict equality checks simply return `false`)

## Phase 5 - Settings And UI Consistency

### 5.1 Fix settings search behavior — ✅ Complete

**Result:**
- Sidebar nav now renders `filteredCategories` when a search query is active, keeping nav and content in sync.
- Added compact `EmptyState` when no categories match the search query.
- Error retry uses `loadStatus()` instead of `window.location.reload()`.

### 5.2 Move `ErrorBoundary` styles to CSS Module — ✅ Complete

**Result:**
- Created `ErrorBoundary.module.css` with `.wrapper`, `.title`, `.message` classes using theme CSS vars.
- Replaced inline styles with CSS Module classes.
- Replaced inline `<button>` with shared `<Button variant="primary">` component.

## Phase 6 - Backend Quality Follow-Up

### 6.1 Review directory size semantics — ✅ Complete

**Result:**
- Renamed `entrySize` → `immediateDirSize` to clarify it sums only immediate file children (one level deep via `os.ReadDir`), not recursive subtree sizes.
- Test assertion updated to reference the new name.
- Frontend uses `formatBytes(entry.size)` without misleading labels; no frontend change needed.

### 6.2 Consolidate claim-next job logic — ✅ Complete

**Result:**
- Extracted private `claimNextJob(ctx, types...)` helper in `store_claiming.go` — handles the shared transaction + query + update + commit pattern.
- Public methods (`ClaimNextTransferJob`, `ClaimNextArchiveJob`, `ClaimNextChecksumJob`) are one-liner wrappers.
- Added `repeatParams` helper for dynamic `IN (?, ?, ...)` placeholders.
- All existing store tests still pass.

## Verification Standard

After each implementation phase:

- Run frontend lint and type-check through Docker when possible.
- Run backend tests through Docker because Go is not installed locally.
- Run the relevant focused tests before full Docker build where practical.
- Start the Docker dev server only after lint/type-check passes.
