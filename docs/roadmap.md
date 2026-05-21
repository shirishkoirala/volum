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

- Single-select and multi-select `[done]`
- Keyboard selection basics `[done]`
- Context menu `[done]`
- Toolbar actions for selected items `[done]`
- Sort by name, size, type, and modified date `[done]`
- Hidden file toggle polish `[done]`
- Refresh current folder `[done]`

## Phase 3: Persistent Copy Jobs

Goal: implement the core Volum architecture.

- Create copy job API `[done]`
- Persist job and job item records in SQLite `[done]`
- Background worker processes queued jobs `[done]`
- Copy to `.volum-tmp/*.partial` `[done]`
- Verify copied size before final rename `[done]`
- Never overwrite destination silently `[done]`
- Track total bytes and processed bytes `[done]`
- Track current item `[done]`
- Track speed and ETA
- Show active, completed, failed, and cancelled jobs in the UI `[done]`

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

1. Add speed and ETA calculation for running copy jobs.
2. Add a Server-Sent Events endpoint for job updates.
3. Replace frontend job polling with live updates.
4. Add cancel action for running jobs.
5. Add retry action for failed jobs.
6. Mark interrupted running jobs safely on startup.
