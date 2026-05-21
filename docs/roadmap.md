# Volum Roadmap

Volum should be built in small, verifiable phases. The priority order is data safety, reliability, progress visibility, simple UX, performance, then extra features.

## Phase 1: Usable File Browser

Goal: make Volum useful for basic local browsing on Docker for Mac and Ubuntu.

- Browse configured roots `[done]`
- Show empty folder states clearly `[done]`
- Create folder `[done]`
- Rename file or folder `[done]`
- Delete with confirmation `[done]`
- Download files `[done]`
- Improve file icons and metadata display
- Add basic error messages for permission and path failures

## Phase 2: File Selection and Actions

Goal: make the UI behave like a real file manager.

- Single-select and multi-select
- Keyboard selection basics
- Context menu
- Toolbar actions for selected items
- Sort by name, size, type, and modified date
- Hidden file toggle polish
- Refresh current folder

## Phase 3: Persistent Copy Jobs

Goal: implement the core Volum architecture.

- Create copy job API
- Persist job and job item records in SQLite
- Background worker processes queued jobs
- Copy to `.volum-tmp/*.partial`
- Verify copied size before final rename
- Never overwrite destination silently
- Track total bytes, processed bytes, current item, speed, and ETA
- Show active, completed, failed, and cancelled jobs in the UI

## Phase 4: Live Job Updates

Goal: make progress visible without browser ownership of the job.

- Add Server-Sent Events endpoint for job updates
- Replace frontend polling with live updates
- Add cancel action
- Add retry action for failed jobs
- Mark interrupted running jobs safely on startup

## Phase 5: Safe Move and Delete

Goal: support destructive operations without unsafe shortcuts.

- Implement move as copy, verify, then delete source
- Delete only after explicit confirmation
- Add audit log entries for destructive operations
- Detect permission denied, missing source, missing destination, and name conflicts
- Add conflict policies: ask, skip, overwrite, rename, cancel

## Phase 6: Uploads

Goal: support common browser-to-server workflows.

- Upload files to current folder
- Drag and drop upload
- Large upload handling
- Upload progress as persistent jobs
- Prevent path traversal in upload targets

## Phase 7: Auth and Roles

Goal: make Volum safe enough for a homelab service.

- Login and logout
- Session or JWT authentication
- Admin role
- Readonly role
- Protect write APIs
- Document recommended Tailscale-only exposure

## Phase 8: Preview and Polish

Goal: improve day-to-day UX after the safe foundations are working.

- Image preview
- Text and code preview
- Video and audio preview
- PDF preview if practical
- Better responsive layout
- More refined visual design
- Favorites and recent locations

## Immediate Next Tasks

1. Add backend APIs for create folder, rename, delete, and download.
2. Add frontend dialogs and buttons for those actions.
3. Add confirmation for delete.
4. Add selection state and a basic context menu.
5. Implement copy job processing after the basic file actions are stable.
