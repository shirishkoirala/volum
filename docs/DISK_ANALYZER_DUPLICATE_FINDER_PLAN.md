# Disk Space Analyzer and Duplicate Finder Plan

## Goal

Make storage investigation reliable for large folders and roots:

- Add a first-class **Storage Analyzer** app alongside Files, Transfers, Trash, and Drives.
- Disk Space Analyzer shows where space is used.
- Duplicate Finder identifies files with identical content.
- Both scans continue on the server if the browser closes.
- Neither feature deletes or modifies files during scanning.

## Current State

The existing Disk Space Analyzer uses `GET /api/files/analyze` and scans synchronously in the request. It stops after depth 4, keeps at most 50 children per directory, silently skips unreadable paths, and cannot be cancelled or resumed after the browser closes.

Checksum jobs already provide persistent server-side hashing, progress, cancellation, pause, and SSE updates. Duplicate Finder should reuse the checksum reader and job infrastructure, not create a second hashing system.

## Product Scope

### Disk Space Analyzer

- Scan one RootGuard-approved file or directory.
- Report total bytes, file count, directory count, and skipped-path count.
- Show the largest directories and files in a sortable list or tree.
- Persist progress and results until normal job pruning removes them.
- Support cancel, pause, and resume.

### Duplicate Finder

- Scan one RootGuard-approved directory.
- Group regular files by size first, then hash only size groups containing multiple files.
- Confirm duplicates with SHA-256 before returning a group.
- Report reclaimable bytes as `file size × (group count - 1)`.
- Let users select duplicate copies and send them through the existing trash job flow.

### Out of Scope for the First Release

- Automatic duplicate deletion.
- Similar-image, similar-video, or fuzzy-name matching.
- Cross-user or cross-root scanning outside the selected public path.
- Scheduled scans, background indexing, or filesystem watchers.
- Keeping a permanent checksum catalogue.
- Treating directories as duplicates.

## Architecture

Use the existing persistent job system for both scans.

Add two job types:

- `disk_analyze`
- `duplicate_find`

Register them in the job model, unified job creation handler, claiming logic, worker tick, and frontend `JobType`. Both jobs use `sourcePath`; no destination path is needed.

The worker must resolve the source through `RootGuard` before scanning. Symlinks are skipped and never followed. Hidden files should follow the file browser's current hidden-file setting, passed as an explicit job option rather than inferred by the worker.

### Result Storage

Keep job summaries in the existing jobs table and add dedicated result tables. Avoid placing large result documents in a single JSON column.

`disk_usage_results`:

| Column | Purpose |
| --- | --- |
| `job_id` | Owning job |
| `path` | Public RootGuard path |
| `parent_path` | Public parent path |
| `name` | Display name |
| `is_dir` | Directory or file |
| `size_bytes` | Recursive size for directories; file size for files |
| `file_count` | Recursive file count |
| `dir_count` | Recursive directory count |

`duplicate_results`:

| Column | Purpose |
| --- | --- |
| `job_id` | Owning job |
| `group_id` | Stable group identifier within the job |
| `path` | Public RootGuard path |
| `size_bytes` | File size |
| `checksum` | Confirming SHA-256 digest |
| `modified_at` | Display and user decision support |

Use foreign keys with `ON DELETE CASCADE` so pruning a job also removes its scan results.

## Backend Plan

### Phase 1: Persistent Disk Analysis

1. Add `disk_analyze` to job creation and claiming.
2. Replace the request-bound recursive analyzer with a worker scan using `filepath.WalkDir` and request/job context cancellation.
3. Accumulate recursive directory totals bottom-up.
4. Write results in batches inside short transactions.
5. Throttle job progress updates to approximately twice per second.
6. Track skipped paths instead of silently losing them.
7. Add paginated result endpoints:
   - `GET /api/jobs/{id}/disk-usage?parent=&limit=&offset=&sort=`
   - `GET /api/jobs/{id}/disk-usage/summary`
8. Keep `GET /api/files/analyze` temporarily only if an existing client still needs it; remove it after the frontend migration.

The first progress phase counts discovered entries while scanning. An exact percentage is optional until discovery completes; the UI can show an indeterminate scan state rather than walking the tree twice.

### Phase 2: Duplicate Finder

1. Add `duplicate_find` to job creation and claiming.
2. Walk regular files once and group candidates by size.
3. Discard single-file size groups.
4. For remaining candidates, hash a small prefix first (for example 64 KiB) to avoid full reads of obviously different files.
5. Compute SHA-256 only for matching size-and-prefix groups.
6. Store only confirmed groups containing at least two files.
7. Add paginated endpoints:
   - `GET /api/jobs/{id}/duplicates?limit=&offset=`
   - `GET /api/jobs/{id}/duplicates/summary`
8. Reuse the existing trash job endpoint for selected cleanup paths.

Do not reuse checksum job items as duplicate results. Checksum items represent per-file job execution, while duplicate groups need group-oriented querying and reclaimable-space totals.

### Scan Rules

- Resolve the initial public path with `RootGuard.Resolve`.
- Never follow symlinks.
- Skip `.volum-trash` and `.volum-tmp`.
- Continue past permission and transient filesystem errors while incrementing `skippedCount`.
- Treat hard links with the same device/inode as one physical file so they are not reported as reclaimable duplicates.
- Re-stat a file before and after hashing. If size or modification time changes, skip it as unstable.
- Check pause/cancel state on a time interval, not once per file.

## Frontend Plan

### Storage Analyzer App

- Add `storage-analyzer` to `ActiveView` and the existing navigation state.
- Add a **Storage Analyzer** desktop icon and dock item using the asset SVG icon convention.
- Render `StorageAnalyzerView` as a workspace page, not an overlay or window.
- Give the app two sections: **Disk Usage** and **Duplicates**.
- Keep the last selected section and scan path while navigating within the current browser session.
- Show active scan status on the app icon only if the existing badge pattern can be reused without new badge infrastructure.

The app opens to a path picker when no scan exists. Users can choose a configured root or browse to a directory before starting either scan.

### Additional Entry Points

- Keep **Analyze disk usage** in the file context menu as a shortcut that opens the Storage Analyzer app on **Disk Usage** with the selected path filled in.
- Add **Find duplicates** for directories and roots as a shortcut that opens the same app on **Duplicates**.
- Admin users can start scans and trash selected duplicates; readonly users can view completed results but cannot start or clean up scans.

### Disk Analyzer View

Replace the request-bound overlay with the **Disk Usage** section of the Storage Analyzer app. It shows:

- Scan status and progress.
- Total size, files, directories, and skipped paths.
- Sort controls for largest size, name, files, or folders.
- Expandable directory rows loaded on demand from the paginated endpoint.
- Cancel, pause, resume, and retry actions through existing job controls.

Do not render the entire result tree at once. Load one directory level per expansion and reuse the existing incremental list pattern.

### Duplicate Finder Section

Show:

- Duplicate group count and reclaimable bytes.
- Groups sorted by reclaimable bytes, largest first.
- File path, size, and modification time for each copy.
- Per-file selection with one copy protected by default.
- **Move selected to Trash** with an explicit confirmation showing file count and bytes.

After cleanup completes, refresh or rerun the duplicate scan. Do not mutate scan results optimistically because filesystem jobs can partially fail.

### Browser Reconnection

The existing jobs SSE stream remains the source of job status. Opening Transfers or Storage Analyzer should fetch stored results by job ID. No scan state should live only in React component state.

### Navigation Changes

Update the existing navigation surfaces rather than creating a second router:

- `useNavigation`: add `showingStorageAnalyzer`, `storageAnalyzerSection`, and the `storage-analyzer` active view.
- `Home`: render `StorageAnalyzerView` when active and provide shortcut handlers for selected paths.
- `DesktopView` / `useDesktopIcons`: add the Storage Analyzer desktop icon.
- `Dock`: add the Storage Analyzer item through the existing `dockItems` array.
- `TopBar` and `StatusBar`: accept the new active view and display **Storage Analyzer**.

Opening the app should close other workspace-page flags through the same navigation reset used by Files, Transfers, Trash, Settings, and Drives.

## API Shapes

Create job:

```json
{
  "type": "disk_analyze",
  "sourcePath": "/storage/media",
  "options": { "includeHidden": false }
}
```

Disk summary:

```json
{
  "jobId": "...",
  "totalBytes": 123,
  "fileCount": 10,
  "directoryCount": 3,
  "skippedCount": 0
}
```

Duplicate summary:

```json
{
  "jobId": "...",
  "groupCount": 4,
  "fileCount": 10,
  "reclaimableBytes": 456,
  "skippedCount": 0
}
```

Keep response fields additive and reuse the existing API error format.

## Testing Plan

### Backend

- RootGuard rejects paths outside configured roots.
- Symlinks and Volum internal directories are skipped.
- Disk directory sizes equal the sum of their included descendants.
- Pagination and sorting are stable.
- Same-size different-content files are not duplicates.
- Identical content with different names is grouped.
- Hard links are not counted as reclaimable duplicates.
- Files changed during hashing are skipped.
- Cancel, pause, resume, retry, and server restart preserve correct job state.
- Result rows are deleted when their owning job is pruned.

### Frontend

- Starting each scan creates the correct job type and source path.
- Progress, empty, error, cancelled, and completed states render correctly.
- Directory expansion fetches only the selected level.
- Duplicate selection always leaves at least one copy unselected by default.
- Readonly users cannot start scans or trash duplicates.
- Reopening the browser restores the scan and results from the server.

### Performance Fixtures

Measure with generated trees containing:

- 1,000 files.
- 10,000 files.
- 100,000 files.
- Many same-size files with different content.
- Large confirmed duplicates.

Record scan duration, peak memory, database growth, and cancellation latency. The worker must stream/batch results rather than hold every file and hash in memory at once.

## Delivery Order

1. Persistent `disk_analyze` job and result storage.
2. Storage Analyzer app shell, navigation entry points, job-backed Disk Usage section, and removal of the synchronous endpoint.
3. Persistent `duplicate_find` job using size, prefix, then SHA-256 grouping.
4. Duplicate Finder section inside Storage Analyzer.
5. Cleanup through existing trash jobs.
6. Large-fixture performance validation and documentation updates.

Each phase should ship independently with Docker lint, type-check, frontend tests, Go tests, and production build passing.

## Definition of Done

- A scan continues after closing the browser and is visible after reopening it.
- Storage Analyzer is available from both the desktop and dock like the other first-class apps.
- The UI never requires one unbounded result response or renders an unbounded tree.
- Duplicate groups are content-confirmed and exclude hard-link false positives.
- Cleanup uses existing persistent trash jobs and requires confirmation.
- RootGuard remains the only filesystem boundary.
- Docker verification passes for frontend and backend.
