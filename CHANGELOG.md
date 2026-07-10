# Changelog

All notable changes to this project are documented here. Based on [Keep a
Changelog](https://keepachangelog.com/).

## Unreleased

### Added
- Route-level middleware audit tests covering ~80 routes across public, auth,
  and admin groups
- Dependabot configuration for GitHub Actions, npm, Go modules, and Docker
- READMEs for `frontend/src/contexts/` and `tools/visual/` directories

### Changed
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
- Upload filenames with leading/trailing spaces are now trimmed before storage

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
