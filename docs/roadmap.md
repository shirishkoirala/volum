# Volum Cleanup Roadmap

This roadmap tracks the current inconsistency, KISS, YAGNI, and SOLID cleanup work. Fix correctness first, then reduce coupling, then polish conventions.

## Phase 1 - Correctness

### 1.1 Fix checksum job scheduling

**Problem:** `Worker.runOnce` returns when no archive/extract job is queued, so checksum jobs can starve.

**Files:**
- `backend/internal/worker/worker.go`
- `backend/internal/worker/worker_test.go`

**Plan:**
- Continue from archive/extract claim to checksum claim when no archive job exists.
- Keep one-job-per-tick behavior only when a job is actually claimed.
- Add a test where only a checksum job is queued and `runOnce` processes it.

**Acceptance:**
- Queued checksum jobs run without requiring an archive/extract job.
- Worker tests cover transfer, archive/extract, and checksum claim order.

### 1.2 Complete directory checksum jobs

**Problem:** `checksumDir` creates item records but never marks the parent job complete.

**Files:**
- `backend/internal/worker/checksum.go`
- `backend/internal/worker/worker_test.go`

**Plan:**
- Call `CompleteJob` after the directory walk succeeds.
- Preserve cancellation and pause behavior.
- Add a test for directory checksum completion.

**Acceptance:**
- Directory checksum jobs move to `completed`.
- Cancelled/paused checksum jobs do not incorrectly complete.

## Phase 2 - Frontend State Ownership

### 2.1 Deduplicate view preference persistence

**Problem:** Folder preference load/save logic exists in both `useViewPreferences` and `Home`.

**Files:**
- `frontend/src/hooks/useViewPreferences.ts`
- `frontend/src/screens/Home.tsx`

**Plan:**
- Make `useViewPreferences` the single owner of folder preference persistence.
- Expose a small API for applying preferences during navigation if needed.
- Remove duplicate effects from `Home`.

**Acceptance:**
- No duplicated folder preference effects.
- Switching folders still restores per-folder view, sort field, and sort direction.
- Trash still restores `columns` mode correctly after exit.

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

### 3.1 Reduce `FilesView` prop surface

**Problem:** `FilesViewProps` has 40+ props and includes unused props.

**Files:**
- `frontend/src/pages/FilesView.tsx`
- `frontend/src/screens/Home.tsx`
- File view child components under `frontend/src/components/ui/`

**Plan:**
- Remove unused props: `entries`, `contextMenu`, `onCloseContextMenu`.
- Group remaining props into cohesive objects:
  - `navigation`
  - `search`
  - `selection`
  - `dragDrop`
  - `rename`
  - `permissions`
- Consider moving `renderEntries` selection into a dedicated component.

**Acceptance:**
- `FilesViewProps` is smaller and grouped by responsibility.
- No dead props are passed from `Home`.
- TypeScript catches missing workflow groups cleanly.

### 3.2 Extract shared context menu shell

**Problem:** Context menu components duplicate focus, keyboard navigation, bounds positioning, click handling, and ARIA setup.

**Files:**
- `frontend/src/components/overlay/FileContextMenu.tsx`
- `frontend/src/components/overlay/DesktopContextMenu.tsx`
- `frontend/src/components/overlay/TrashContextMenu.tsx`
- `frontend/src/components/overlay/FilesEmptyMenu.tsx`
- `frontend/src/components/overlay/JobsEmptyMenu.tsx`
- New `frontend/src/components/overlay/ContextMenuShell.tsx`

**Plan:**
- Add `ContextMenuShell` with x/y positioning, focus, keyboard navigation, role, and click stop.
- Keep each menu responsible only for its menu items and command wiring.

**Acceptance:**
- Shared context menu behavior lives in one place.
- All menus retain keyboard and mouse behavior.

## Phase 4 - API And Utility Separation

### 4.1 Split API types, endpoint functions, and file predicates

**Problem:** `client.ts` mixes DTOs, fetch plumbing, endpoint calls, URL builders, disk usage types, and file extension predicates.

**Files:**
- `frontend/src/api/client.ts`
- `frontend/src/utils/preview.ts`
- New files under `frontend/src/api/` or `frontend/src/utils/`

**Plan:**
- Keep fetch plumbing and endpoint functions in `api/client.ts`.
- Move API DTOs to `api/types.ts` if the client remains too large.
- Move extension predicates to `utils/fileTypes.ts`.
- Update `preview.ts` to depend on utilities, not API client internals.

**Acceptance:**
- `client.ts` no longer exports media/file-type predicates.
- `preview.ts` imports extension checks from `utils/fileTypes.ts`.
- No behavior change in preview/download flows.

### 4.2 Tighten job type modeling

**Problem:** Frontend job `type` and `status` are plain `string`, reducing type safety around known backend values.

**Files:**
- `frontend/src/api/client.ts` or `frontend/src/api/types.ts`
- `frontend/src/utils/jobs.ts`
- `frontend/src/pages/JobsPage.tsx`

**Plan:**
- Add frontend union types for known job types and statuses.
- Keep fallback handling if backend returns an unknown value.

**Acceptance:**
- Job UI predicates use typed statuses.
- Unknown statuses do not crash rendering.

## Phase 5 - Settings And UI Consistency

### 5.1 Fix settings search behavior

**Problem:** Settings search filters content but not nav, and a no-match query can show blank content with no empty state.

**Files:**
- `frontend/src/pages/SettingsPanel.tsx`
- `frontend/src/pages/SettingsPanel.module.css`

**Plan:**
- Render `filteredCategories` in nav while searching.
- Add a compact empty state for no matching categories.
- Use `loadStatus` for retry instead of `window.location.reload()`.

**Acceptance:**
- Search results are consistent between nav and content.
- No-match search shows a clear empty state.
- Failed status retry does not reload the full app.

### 5.2 Move `ErrorBoundary` styles to CSS Module

**Problem:** `ErrorBoundary` uses inline styling, unlike the project CSS Module convention.

**Files:**
- `frontend/src/components/ui/ErrorBoundary.tsx`
- New `frontend/src/components/ui/ErrorBoundary.module.css`

**Plan:**
- Replace inline styles with CSS Module classes.
- Reuse shared `Button` where practical.

**Acceptance:**
- No inline layout/theme styles remain in `ErrorBoundary`.
- Error boundary remains visually equivalent.

## Phase 6 - Backend Quality Follow-Up

### 6.1 Review directory size semantics

**Problem:** `entrySize` only sums immediate files, while the UI polling names imply directory sizes. This may be intentional, but the semantics are unclear.

**Files:**
- `backend/internal/files/service.go`
- `backend/internal/files/service_test.go`
- `frontend/src/screens/Home.tsx`

**Plan:**
- Decide whether directory size should be immediate or recursive.
- Rename helpers/UI expectations if immediate size is intended.
- If recursive size is desired, implement with cancellation/backpressure considerations.

**Acceptance:**
- Directory size behavior is documented by test names and helper names.
- Frontend labels match backend behavior.

### 6.2 Consolidate claim-next job logic

**Problem:** `ClaimNextTransferJob`, `ClaimNextArchiveJob`, and `ClaimNextChecksumJob` duplicate most SQL/transaction logic.

**Files:**
- `backend/internal/jobs/store_claiming.go`

**Plan:**
- Extract a private helper that claims the next queued job by allowed types.
- Keep public methods if they help preserve worker readability.

**Acceptance:**
- Claim logic has one implementation.
- Existing store tests still pass.

## Verification Standard

After each implementation phase:

- Run frontend lint and type-check through Docker when possible.
- Run backend tests through Docker because Go is not installed locally.
- Run the relevant focused tests before full Docker build where practical.
- Start the Docker dev server only after lint/type-check passes.
