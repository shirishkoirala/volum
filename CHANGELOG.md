# Changelog

All notable changes to this project are documented here. Based on [Keep a
Changelog](https://keepachangelog.com/).

## Unreleased

## v0.2.0 - 2026-07-14

### Added

- Storage Analyzer app with disk-usage scanning and duplicate finding through
  persistent background jobs
- Paginated large-folder browsing with incremental rendering and defensive
  preview size limits
- Search results page with file actions and folder analysis
- Per-file conflict resolution and checksum-based identical-file skipping
- Service health checks, live status events, and optional browser notifications
- Desktop wallpaper settings, pinned folder shortcuts, and a top-bar calendar
- Route-level middleware audit tests covering ~80 routes across public, auth,
  and admin groups
- Dependabot configuration for GitHub Actions, npm, Go modules, and Docker
- READMEs for `frontend/src/contexts/` and `tools/visual/` directories

### Changed

- Unified the desktop, mobile, and windowed app layouts with shared frosted
  surfaces, navigation, hover states, and light-theme contrast
- Reorganized frontend components by role and reduced `App.tsx` to a thin
  routing shell
- Split large backend handlers, workers, stores, and frontend API modules into
  focused files
- Improved job labels, action icons, storage navigation, and folder selection
- Split `handlers_upload.go` (698 lines) into `upload_common.go`,
  `upload_multipart.go`, and `upload_chunk.go`
- Split `worker.go` (776 lines) into `worker.go`, `transfer.go`, and
  `archive_jobs.go`
- Split `Dialogs.tsx` (419 lines) into `ConfirmDialog.tsx`,
  `TextInputDialog.tsx`, and `TransferDialog.tsx`
- Split `api/client.ts` (688 lines) into 7 domain files with barrel export
- Split `SettingsPanel.tsx` (772 lines) into 6 category components
- Extracted `FilesViewOverlays`, `HomeOverlays`, `SearchResultsOverlays`,
  `UserMenu`, `WindowTitleBar`, `FileEntriesView`, `BreadcrumbNav`, `menuItems`
  from their respective parent components
- Extracted `useTrashCommands`, `useTransferCommands`, `useDesktopIcons` hooks

### Fixed

- Preserved the signed-out user's avatar and username across page refreshes
- Made trash and restore jobs retry-safe without overwriting a destination that
  was recreated while a restore waited to run
- Persisted file-level Disk Usage results so large files appear alongside
  directory totals
- Kept duplicate results visible until their queued Trash jobs complete, while
  preserving failed or cancelled items for retry
- Restored folder analysis from search results
- Hardened uploads, origin validation, and cleanup of partial failures
- Fixed mobile views rendering alongside windowed apps and aligned responsive
  app gutters and headers
- Upload filenames with leading/trailing spaces are now trimmed before storage
- Documentation audit: fixed stale references to removed files (`server_test.go`,
  `handlers_upload.go`, `visual-audit.mjs`) and stale file sizes across all docs

### Documentation

- Updated docs to reference `make smoke-proxy`, `make visual-audit` instead of
  raw script paths
- Updated change guides to reference domain-specific `client-*.ts` files instead
  of the monolithic `client.ts`
- Updated CONTRIBUTING.md test and client references to current file layout
- Removed `storage/deadcode.md` (leftover from unrelated project)

### Infrastructure

- Coverage reporting (vitest + Go, CI informational, baseline recorded)
- Smoke tests in scheduled CI (basic + reverse-proxy upload)
- ShellCheck and lychee link checker (CI + Makefile)
- Visual tools package (`tools/visual/` with Playwright)

## v0.1.0 - Initial Release

Volum is a self-hosted desktop-style file manager for home servers and Docker
hosts.

### Highlights

- Desktop workspace with Files, Drives, Trash, Transfers, Settings, and pinned
  folder shortcuts.
- Root-guarded file operations with background jobs for copy, move, upload,
  archive, extract, checksum, trash, and restore.
- Upload reliability hardening with resumable chunk uploads, filename
  normalization, cleanup on failure, and reverse-proxy upload smoke coverage.
- Conflict handling for copy/move jobs, including skip-identical and per-file
  conflict resolution.
- Search results page with direct actions such as preview, share, rename, copy,
  move, delete, archive, extract, and checksum.
- Preview support for images, media, PDFs, and text with defensive size limits.
- Share links with optional password, expiry, and download limits.
- Admin settings for database maintenance, desktop wallpaper, service
  shortcuts, notification preferences, and share management.
- Docker deployment with reverse-proxy support and GHCR image publishing.
