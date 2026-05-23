# Volum Roadmap v2

Volum is the only self-hosted file manager that combines a **desktop metaphor** (drives, trash, icons), a **background job engine** (copy/move/archive with retry/pause/cancel), and **rich media previews** (images, video, audio, PDF, text). The competition splits: FileBrowser has the stars but broken thumbnails and no jobs; Filestash has multi-backend but no desktop UX. Volum spans both.

## Principles

- **Reliability before novelty**: every destructive or long-running operation must be resumable, observable, and recoverable.
- **Filesystem safety is non-negotiable**: every backend path must continue through `RootGuard`.
- **UI actions should feel local**: avoid full page refreshes, preserve selection where useful, and show job/file changes immediately.
- **Admin and readonly roles must stay clear**: readonly users can browse, preview, and download; write operations stay admin-only.
- **Keep Docker-first deployment simple**: one container should remain enough for normal homelab use.
- **Speed over slickness**: users consistently rank load times above visual polish. Every render should feel instant.

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
| Share links | Expiring, password-protected, max-downloads. ShareDialog + ShareManager (list/revoke) |
| Observability | Settings page: version, DB maintenance (vacuum, prune jobs/audit), root health, worker status |
| Desktop view | Physical drives with partition detail, trash icon, settings icon |
| Utility states | Empty folder UI (icon + "New Folder" button) |

## Phase 1 — Ship It

Goal: a tagged release that someone can discover, deploy, and trust.

| # | Task | Notes |
|---|------|-------|
| 1.1 | **Version endpoint** | Expose `GET /api/version` from `backend/internal/version/`. Show in settings footer |
| 1.2 | **Multi-arch Docker** | Build `linux/amd64` + `linux/arm64` in CI or buildx. FileBrowser users consistently complain about missing arm64 |
| 1.3 | **Release checklist** | Write `RELEASE.md`: tag -> build -> smoke test -> changelog -> publish |
| 1.4 | **README screenshots** | 4-6 screenshots: desktop view, file grid, preview modal, job drawer |
| 1.5 | **Quick-start compose** | One-file `docker-compose.yml` that "just works" -- minimal config, clear comments |

Acceptance:
- A user can `git clone && docker compose up`, see it in 30 seconds.
- Docker images are published for both architectures.
- Release process is documented and reproducible.

## Phase 2 — Discoverability & Trust

Goal: someone searching "self-hosted file manager" finds Volum and tries it.

| # | Task | Notes |
|---|------|-------|
| 2.1 | **Awesome-selfhosted PR** | Submit Volum to the list under File Transfer > Web-based File Managers |
| 2.2 | **Demo instance** | Public read-only demo (e.g. `demo.volum.app`) with sample files |
| 2.3 | **Smoke test script** | `scripts/smoke.sh` -- curl health, browse a root, verify auth. Run in CI |
| 2.4 | **Reverse proxy docs** | Nginx + Traefik examples with `VOLUM_PUBLIC_BASE_URL`. This is the #1 support issue for FileBrowser |

Acceptance:
- Volum appears in awesome-selfhosted.
- Demo is reachable and functional.
- Smoke test catches regressions before release.
- Reverse proxy setups are documented and reproducible.

## Phase 3 — File Manager UX Gaps

Goal: close the features users actually ask for in Reddit, HN, and GitHub.

| # | Task | Notes |
|---|------|-------|
| 3.1 | **Quick share ("Send")** | Right-click -> "Share" -> copy link. Minimal: no password, no expiry, just a one-click temp share. Keep current ShareDialog for power users who want configuration |
| 3.2 | **Disk usage analyzer** | Tree-style visualization: what folders/files are eating space. "Disk Usage" action on any folder, shows sorted breakdown. Consistently requested in homelab communities |
| 3.3 | **Per-folder view preferences** | Currently global-only. Save `volum_viewMode` etc. per directory path |
| 3.4 | **Dual-pane / split view** | Side-by-side browse for copy/move workflows. Users coming from desktop file managers expect this |
| 3.5 | **Bookmarks / pinned paths** | Quick-jump sidebar section for frequently used folders. Simple: store list in localStorage |

Acceptance:
- A user coming from macOS Finder or Windows Explorer can do everything they expect without reaching for the terminal.

## Phase 4 — Power User Features

Goal: features that make Volum indispensable for the self-hosted crowd.

| # | Task | Notes |
|---|------|-------|
| 4.1 | **WebDAV endpoint** | Expose each root via WebDAV so Finder/Nautilus can mount Volum as a network drive. Bridges the gap: power users get native file manager, casual users get web UI |
| 4.2 | **Audit log UI** | Backend already logs everything to `audit_logs`. Surface it in settings: filterable table of who did what when |
| 4.3 | **Duplicate finder** | Hash-based duplicate detection as a background job. Scan a folder -> report of duplicates with size savings |
| 4.4 | **Disk health monitoring** | SMART data for physical drives (when available via `smartctl`). Surface in settings alongside root health |
| 4.5 | **Notification hooks** | Webhook / Gotify / ntfy integration for job completion, disk space warnings, share access |

Acceptance:
- Volum replaces 3-4 separate tools for a typical homelab user.

## Phase 5 — Polish & Ecosystem

Goal: long-term sustainability and community.

| # | Task | Notes |
|---|------|-------|
| 5.1 | **E2E test suite** | Playwright tests for critical paths: login, browse, upload, preview, share, trash |
| 5.2 | **Mobile PWA** | Service worker, offline cache, "Add to Home Screen" for phone/tablet access |
| 5.3 | **i18n framework** | Not translating yet, but wire up the framework so community can contribute translations |
| 5.4 | **Plugin/hook system** | Allow custom actions registered via config. Example: "Send to Jellyfin" on media files |
| 5.5 | **Theme marketplace** | Community-contributed color schemes beyond light/dark |

Acceptance:
- Volum has a contributing guide, test framework, and community contribution surface area.

## Backlog

Not blocked on anything above, but no immediate plans to pick up:

- Multi-user accounts beyond admin/readonly
- Media metadata indexing (EXIF, album art)
- Rule-based automation (e.g. "auto-extract zip files")
- WebDAV or SMB bridge integration (moved to Phase 4)

## Completed

### Current Session

- [x] Admin share management UI (ShareManager -- list/revoke/copy-link)
- [x] Settings page (version, DB maintenance, root health, worker status)
- [x] Desktop drive view (physical drives -> partition contents)
- [x] Empty folder UI (centered icon + "New Folder" button)
- [x] Scrollbar theming (global WebKit + Firefox, removed per-component overrides)
- [x] Desktop settings icon (SVG from assets, removed from sidebar)

### Previous Sessions

- [x] Docs refresh: `README.md`, `docs/security.md`, `docs/handoff.md` updated to reflect actual product state.
- [x] Frontend tests expanded: dialog component tests (`ConfirmDialog`, `TextInputDialog`, `ToastViewport`, `FolderSuggestions`) and `FolderPicker` tests added.
- [x] Reusable `FolderPicker` component built and wired into `TransferDialog` for copy/move destination browsing.
- [x] CSS Modules migration: 7 scoped modules, global.css reduced from 2173 to 96 lines.
- [x] Trash view overhaul: own page with grid/list views, selection, context menu, BreadcrumbBar, file/folder icons.
- [x] Conflict preview dialog: scans destination, shows fate of each file (new/skip/overwrite/rename/cancel) before proceeding.
- [x] Drag-and-drop into folders: drag files onto directory rows to open transfer dialog pre-filled with destination.
- [x] Breadcrumb overflow: collapsible crumbs with "..." overflow menu when path exceeds available width.
- [x] Saved view preferences: view mode, sort field/direction, hidden files persisted to localStorage.
- [x] Undo affordances: toast with Undo button after trash restore and rename (8s timeout).
- [x] Conflict preview for archive/extract: checks destination existence and shows confirmation dialog before creating or extracting archives.
- [x] Toast system enhanced with action button support.
- [x] Sharing & Collaboration: shares table, API endpoints (create/list/delete/public-download), ShareDialog component with password/expiration/max-downloads controls, public download with validation (expiry, password, max downloads).
