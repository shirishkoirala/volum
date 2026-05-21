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
- Track speed and ETA `[done]`
- Show active, completed, failed, and cancelled jobs in the UI `[done]`

## Phase 4: Live Job Updates

Goal: make progress visible without browser ownership of the job.

- Add Server-Sent Events endpoint for job updates `[done]`
- Replace frontend polling with live updates `[done]`
- Add cancel action `[done]`
- Add retry action for failed jobs `[done]`
- Mark interrupted running jobs safely on startup `[done]`

## Phase 5: Safe Move and Delete

Goal: support destructive operations without unsafe shortcuts.

- Implement move as copy, verify, then delete source `[done]`
- Delete only after explicit confirmation `[done]`
- Add audit log entries for destructive operations `[done]`
- Detect permission denied, missing source, missing destination, and name conflicts `[done]`
- Add conflict policies: ask, skip, overwrite, rename, cancel `[done]`

## Phase 6: Uploads

Goal: support common browser-to-server workflows.

- Upload files to current folder `[done]`
- Drag and drop upload `[done]`
- Large upload handling `[done]`
- Upload progress as persistent jobs `[done]`
- Prevent path traversal in upload targets `[done]`

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

1. Add login and logout.
2. Add session or JWT authentication.
3. Add admin and readonly roles.
4. Protect write APIs.
5. Document recommended Tailscale-only exposure.
