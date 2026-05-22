# Volum Roadmap

Volum is no longer in MVP mode. The base file manager, job engine, auth, previews, archive/extract, search, batch rename, keyboard shortcuts, and desktop-style UI are in place.

The next roadmap should protect that foundation while turning Volum into a dependable daily-use file manager for a home server.

## Principles

- Reliability before novelty: every destructive or long-running operation must be resumable, observable, and recoverable.
- Filesystem safety is non-negotiable: every backend path must continue through `RootGuard`.
- UI actions should feel local: avoid full page refreshes, preserve selection where useful, and show job/file changes immediately.
- Admin and readonly roles must stay clear: readonly users can browse, preview, and download; write operations stay admin-only.
- Keep Docker-first deployment simple: one container should remain enough for normal homelab use.

## Current Baseline

| Area | Status |
|------|--------|
| Browsing | Roots, grid/list/column/desktop views, sorting, hidden files, favorites, recents |
| File actions | Create folder, rename, batch rename, copy, move, trash, restore, permanent delete |
| Jobs | Persistent SQLite jobs, SSE updates, cancel/retry, per-item retry, clear history |
| Transfers | Upload, file download, streamed directory zip download |
| Archives | Create/extract zip, tar, tar.gz |
| Metadata | Info panel, permissions editor, checksums, folder size/disk usage |
| Search | Global search across roots with content grep |
| UX | Context menus, keyboard shortcuts, drag select, touch long-press, thumbnails, dark mode |
| Auth | Admin and readonly session-cookie auth |

## Phase 1: Product Hardening

Goal: make the existing feature set trustworthy under real use.

- Expand frontend tests around `App.tsx` workflows: selection, rename, copy/move dialogs, archive/extract, paste shortcuts, and readonly gating.
- Add backend regression tests for recently added archive/extract destination handling and job completion refresh behavior.
- Add a lightweight smoke script for Docker Compose startup, health check, and a simple browse request.
- Review all stale docs and align `README.md`, `docs/security.md`, and `docs/handoff.md` with the actual implemented feature set.
- Add UI empty/error/loading states audit: no silent failures, no dead buttons, no confusing disabled states.

Acceptance:

- Frontend and backend tests cover the highest-risk user flows.
- Documentation reflects the current product, not the original MVP plan.
- A fresh clone can be started and verified from docs alone.

## Phase 2: File Manager UX Completion

Goal: close the remaining interaction gaps that users expect from a desktop-class file manager.

- Add a real folder picker component for every destination field, including copy, move, archive, and extract.
- Add conflict preview before large copy/move/extract operations so users know what will skip, overwrite, or rename.
- Improve drag-and-drop inside the app: drag selected files into folders to move/copy with a modifier-aware confirmation.
- Add breadcrumb overflow handling and quick root switching for deep paths.
- Add saved view preferences per folder or globally: view mode, sort field, sort direction, hidden files, sidebar width.
- Add undo affordances where feasible: trash restore, recent rename, and recent move.

Acceptance:

- Destination entry no longer depends on typing paths.
- Common file actions are reachable from toolbar, context menu, keyboard, and touch where appropriate.
- Navigation and selection state behave consistently across all views.

## Phase 3: Sharing And Collaboration

Goal: support controlled file sharing without turning Volum into a public cloud product.

- Add expiring share links for files and folders, disabled by default.
- Add per-share controls: readonly download, optional password, expiration, max downloads.
- Add admin share management UI.
- Add audit log visibility for auth events, shares, downloads, deletes, permission changes, and job creation.
- Add optional public-base-url configuration for reverse proxy deployments.

Acceptance:

- Sharing is explicitly opt-in and admin-only.
- Share access never grants broader filesystem access than the target path.
- Audit trail answers who did what and when.

## Phase 4: Observability And Maintenance

Goal: make Volum easy to operate on a long-running home server.

- Add settings/status page: app version, database path, configured roots, root health, disk usage, worker status.
- Add job history export/import if still useful after audit log improvements.
- Add log level configuration and structured request/job logging.
- Add database maintenance actions: vacuum, prune old jobs, prune old audit logs.
- Add root availability warnings when mounted drives disappear.
- Add backup guidance for `volum.db` and configuration.

Acceptance:

- Admin can tell whether Volum is healthy from the UI.
- Common maintenance tasks do not require poking through SQLite manually.
- Missing mounts and job failures are obvious.

## Phase 5: Packaging And Release

Goal: make Volum straightforward to install, upgrade, and trust.

- Add version metadata shown in UI and logs.
- Add release checklist: tests, Docker build, migration check, smoke test, changelog.
- Publish multi-arch Docker images.
- Add sample Compose files for local, homelab, Tailscale/reverse-proxy, and readonly-demo setups.
- Add upgrade notes and migration compatibility rules.
- Add screenshots or short GIFs to the README once UI stabilizes.

Acceptance:

- A tagged release can be built and deployed repeatably.
- Users can upgrade without losing jobs, trash records, audit logs, or settings.
- Deployment docs cover the common homelab paths.

## Backlog

These are useful, but should not interrupt the phases above unless they become real user pain.

- WebDAV or SMB bridge integration
- Media metadata indexing
- Duplicate finder
- Rule-based automation
- Multi-user accounts beyond admin/readonly
- End-to-end browser tests with Playwright
- Internationalization

## Completed

- [x] Docs refresh: `README.md`, `docs/security.md`, and `docs/handoff.md` updated to reflect actual product state.
- [x] Frontend tests expanded: dialog component tests (`ConfirmDialog`, `TextInputDialog`, `ToastViewport`, `FolderSuggestions`) and `FolderPicker` tests added.
- [x] Reusable `FolderPicker` component built and wired into `TransferDialog` for copy/move destination browsing.
- [x] CSS Modules migration: 7 scoped modules, global.css reduced from 2173 to 96 lines.
- [x] Trash view overhaul: own page with grid/list views, selection, context menu, BreadcrumbBar, file/folder icons.
- [x] Conflict preview dialog: scans destination, shows fate of each file (new/skip/overwrite/rename/cancel) before proceeding.

## Next Three Tasks

1. Improve drag-and-drop inside the app: drag selected files into folders to move/copy with a modifier-aware confirmation.
2. Add breadcrumb overflow handling and quick root switching for deep paths.
3. Add saved view preferences per folder: view mode, sort field, sort direction, hidden files.
