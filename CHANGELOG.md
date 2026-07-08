# Changelog

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
