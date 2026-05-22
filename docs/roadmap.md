# Volum Roadmap

Volum is built in small, verifiable phases. Priority order: **data safety → reliability → progress visibility → simple UX → performance → extra features**.

---

## Phase 1: Usable File Browser `[done]`

- Browse configured roots
- Empty folder states
- Create folder
- Rename file/folder
- Delete with confirmation
- Download files
- Error messages for permission/path failures
- File metadata (size, modified date, permissions)

## Phase 2: File Selection and Actions `[done]`

- Single-select and multi-select (Ctrl/Cmd, Shift-range)
- Keyboard shortcuts (Escape, Enter)
- Keyboard rename shortcut (F2) `[done]`
- File clipboard shortcuts (Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V) `[done]`
- Context menu
- Toolbar actions for selected items
- Sort by name, size, type, modified date
- Hidden file toggle
- Refresh current folder

## Phase 3: Persistent Copy Jobs `[done]`

- Copy job API
- Persistent job/item records in SQLite
- Background worker
- Copy to `.volum-tmp/*.partial`
- Size verification before final rename
- Never overwrite silently
- Track total/processed bytes, current item, speed, ETA
- Jobs panel (active, completed, failed, cancelled)

## Phase 4: Live Job Updates `[done]`

- Server-Sent Events for job state
- Cancel job
- Retry failed job
- Mark interrupted running jobs on startup

## Phase 5: Safe Move and Delete `[done]`

- Move = copy + verify + delete source
- Delete requires explicit confirmation
- Audit log entries
- Detect permission denied, missing source/dest, name conflicts
- Conflict policies: ask, skip, overwrite, rename, cancel

## Phase 6: Uploads `[done]`

- Upload files to current folder
- Drag and drop
- Upload manifest for size verification
- Upload progress as persistent jobs
- Path traversal protection

## Phase 7: Auth and Roles `[done]`

- Login/logout with HMAC-signed session cookies
- Admin role (full write access)
- Readonly role (browse, preview, download)
- Protect write APIs by role
- Tailscale/WireGuard exposure guidance

## Phase 8: Preview and Polish `[done]`

- Image preview (png, jpg, gif, svg, webp, etc.)
- Video/audio preview with HTML5 controls
- Text/code preview with dark theme
- CSS design tokens (colors, spacing, radii, transitions)
- Responsive layout (desktop, tablet, mobile)
- Hover/active/focus states
- Double-click/Enter for file preview
- In-place rename `[done]`
- App-native dialogs for create/delete/copy/move confirmations `[done]`
- Toast notifications for file and job actions `[done]`

---

## Phase 9: Job Engine Completion

Goal: finish the job system with pause/resume, recovery, and archive/extract.

- Pause and resume running jobs `[done]`
- Resume interrupted copy jobs on restart (compare partial file sizes) `[done]`
- Archive/extract frontend UI for zip jobs `[done]`
- Extract archives (zip, tar, tar.gz)
- Create archives (zip, tar.gz from selected items)
- Checksum verification (md5, sha256) as a job type
- Per-item retry for failed items within a job
- Clear completed/failed jobs from history
- Job drawer: filter by status, collapse completed

## Phase 10: Advanced File Manager

Goal: match the capabilities of a desktop file manager.

- File type icons (image, video, code, archive, pdf, etc.) `[done]`
- Folder sizes (calculate total size of directory contents) `[done]`
- Disk usage info per root (free/total space) `[done]`
- Select all / invert selection `[done]`
- Copy/cut selected files to clipboard for paste actions `[done]`
- Recycle bin (`.volum-trash/` per root, restore before permanent delete) `[done]`
- Directory download (archive folder on-the-fly as zip)
- File permissions display as `rwxr-xr-x` with owner/group
- Chmod basic permissions via UI

## Phase 11: Search and Navigation

Goal: make finding files fast.

- Full-text file content search (grep across roots) `[done]`
- Search across all roots simultaneously `[done]`
- Recent locations in sidebar `[done]`
- Favorite/bookmark paths in sidebar `[done]`
- Open file location from search results `[done]`
- Keyboard shortcut for search focus (`/` or `Ctrl+K`) `[done]`

## Phase 12: Batch and Workflow

Goal: handle complex multi-step file operations.

- Batch rename (pattern-based: find/replace, counter, case change) `[done]`
- Copy/move with multiple destination folders `[done]`
- Scheduled jobs (run copy/archive at specific time) `[done]`
- Job chaining (run job B after job A completes) `[done]`
- Export/import job history
- Notification for completed jobs (browser notification API) `[done]`

## Phase 13: Polish and Final UX

Goal: refine the experience for daily homelab use.

- PDF preview (iframe) `[done]`
- Dark mode (CSS custom properties toggle + localStorage) `[done]`
- Loading skeletons (animated pulse cards in grid view) `[done]`
- Keyboard shortcut reference overlay (`?` key) `[done]`
- Thumbnail generation for images/videos in grid view
- Drag-select (rubber band selection like Finder)
- Column view (macOS Finder style)
- File/folder info panel (right-click → Get Info)
- Touch-friendly context menu on mobile

---

## Immediate Next Tasks

1. Add tar/tar.gz archive and extract support — `Phase 9`
2. Export/import job history — `Phase 12`
3. Image/video thumbnails in grid view — `Phase 13`
4. Drag-select (rubber band) — `Phase 13`
5. Column view — `Phase 13`
6. File/folder info panel — `Phase 13`
