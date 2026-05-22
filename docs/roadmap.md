# Volum Roadmap

All original phases are complete. This is a clean slate for future work.

---

## Done

| Phase | Scope |
|-------|-------|
| 1 | Usable file browser — browse, create folder, rename, delete, download, errors |
| 2 | File selection — multi-select, keyboard shortcuts, context menu, sort, hidden toggle |
| 3 | Persistent copy jobs — background worker, partial copy, size verification, progress |
| 4 | Live job updates — SSE, cancel, retry, interrupt recovery |
| 5 | Safe move/delete — copy+verify+delete, audit log, conflict policies |
| 6 | Uploads — drag-and-drop, manifest verification, progress jobs |
| 7 | Auth — HMAC session cookies, admin/readonly roles, protected APIs |
| 8 | Preview and polish — image/video/audio/text/PDF preview, design tokens, responsive |
| 9 | Job engine — tar/tar.gz, checksum (md5/sha256), per-item retry, clear history, filter/collapse drawer |
| 10 | Advanced — owner/group, chmod UI, directory download, folder sizes, disk usage |
| 11 | Search — full-text grep across roots, favorites, recents, keyboard search |
| 12 | Batch/workflow — batch rename, multi-destination, scheduled jobs, chaining, browser notifications |
| 13 | Final UX — desktop view, column view, drag-select, info panel, thumbnails, touch context menu, dark mode |

---

## Testing Complete

| Layer | Tests | Status |
|-------|-------|--------|
| Backend (Go) | 67 tests across 6 packages | All passing |
| Frontend (vitest) | 14 tests (Icon + InfoPanel) | All passing |

---

## Next

1. Export/import job history (low priority)
2. Expand frontend component test coverage
3. Feature requests and bug fixes from real usage

No new features are planned. The project is feature-complete for a self-hosted file manager.
