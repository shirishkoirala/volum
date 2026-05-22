# Volum Roadmap

All major phases are complete. The remaining work is tracked below.

---

## Phase 10: Advanced File Manager `[done]`

- File type icons (image, video, code, archive, pdf, etc.) `[done]`
- Folder sizes (calculate total size of directory contents) `[done]`
- Disk usage info per root (free/total space) `[done]`
- Select all / invert selection `[done]`
- Copy/cut selected files to clipboard for paste actions `[done]`
- Recycle bin (`.volum-trash/` per root, restore before permanent delete) `[done]`
- Directory download (archive folder on-the-fly as zip) `[done]`
- File permissions display as `rwxr-xr-x` with owner/group `[done]`
- Chmod basic permissions via UI `[done]`

## Phase 11: Search and Navigation `[done]`

- Full-text file content search (grep across roots) `[done]`
- Search across all roots simultaneously `[done]`
- Recent locations in sidebar `[done]`
- Favorite/bookmark paths in sidebar `[done]`
- Open file location from search results `[done]`
- Keyboard shortcut for search focus (`/` or `Ctrl+K`) `[done]`

## Phase 12: Batch and Workflow

- Batch rename (pattern-based: find/replace, counter, case change) `[done]`
- Copy/move with multiple destination folders `[done]`
- Scheduled jobs (run copy/archive at specific time) `[done]`
- Job chaining (run job B after job A completes) `[done]`
- Export/import job history
- Notification for completed jobs (browser notification API) `[done]`

## Phase 13: Polish and Final UX `[done]`

- PDF preview (iframe) `[done]`
- Dark mode (CSS custom properties toggle + localStorage) `[done]`
- Loading skeletons (animated pulse cards in grid view) `[done]`
- Keyboard shortcut reference overlay (`?` key) `[done]`
- Thumbnail generation for images/videos in grid view `[done]`
- Drag-select (rubber band selection like Finder) `[done]`
- Column view (macOS Finder style) `[done]`
- File/folder info panel (right-click → Get Info) `[done]`
- Touch-friendly context menu on mobile `[done]`

---

## Immediate Next Tasks

1. Export/import job history — `Phase 12`
2. Automated backend tests
3. Frontend component tests
