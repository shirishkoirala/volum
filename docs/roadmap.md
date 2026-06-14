# Volum Roadmap

This roadmap is based on recurring requests and pain points seen in adjacent self-hosted apps such as File Browser, Homarr, and Homepage, then filtered through Volum's current direction: a reliable server-side file manager with a desktop-like web UI.

Guiding principles:

- **KISS**: prefer focused, understandable workflows over broad platform features.
- **YAGNI**: build the next useful slice, not a speculative monitoring suite.
- **SOLID**: keep backend jobs, file browsing, previews, sharing, desktop services, and UI state isolated enough to evolve independently.

## Priority 1: Large Folder Performance

Status: started. The first slice caps initial rendering for large folders and progressively loads more items as the user scrolls.

Users of web file managers repeatedly report slow or stuck folders with thousands of files, especially when previews or thumbnails are involved.

Planned work:

- Add list virtualization for large file grids/lists.
- Add server-side pagination or cursor-based listing for very large directories.
- Keep preview/thumbnail generation cancelable when navigation changes.
- Add defensive preview limits for very large images, GIFs, and media files.
- Show a clear "large folder" loading state with partial results instead of blocking the whole view.

Completed slice:

- Large folders render the first 240 entries instead of mounting every file item immediately.
- Grid and list views load additional 240-item batches automatically when scrolling near the bottom.
- File view selection/favorite checks use `Set` lookups during rendering instead of repeated array scans.
- `/api/files` accepts `limit` and `offset`, returns `total`/`hasMore`, and only stats entries in the requested page.
- Files view requests the first 600 entries, then appends additional backend pages as the user scrolls near the end.
- Thumbnails are skipped for GIFs and images larger than 8 MB, avoiding full raw-image fetches for expensive previews.
- Inline text, image, and PDF previews now have size gates with explicit download/open fallbacks.

Why now:

- This is core to Volum's job as a file manager.
- It directly matches the preview background-task issue already observed in Volum.

References:

- [File Browser: stuck loading with 10K+ files](https://github.com/filebrowser/filebrowser/issues/1566)
- [File Browser: performance and sharing in folders with ~4000 files](https://github.com/filebrowser/filebrowser/issues/1689)
- [File Browser: huge image thumbnails consuming resources](https://github.com/filebrowser/filebrowser/issues/3888)
- [File Browser: GIF folders loading slowly](https://github.com/filebrowser/filebrowser/issues/3293)

## Priority 2: Preview Window Polish

Status: started. The first slice adds in-preview next/previous navigation within the current folder or filtered result set.

Users expect media previews to preserve browsing state, not reset scroll position, sorting, or folder context.

Planned work:

- Keep previews fully windowed inside the desktop workspace.
- Preserve file list scroll position after closing preview.
- Support next/previous navigation within the current folder or filtered result set.
- Add safe fallback actions: open raw file, download, copy path, share.
- Ensure preview cancellation happens when the window closes or the user navigates away.

Completed slice:

- Preview controls show the current item position within the previewable files in the current folder/filter.
- Previous/next buttons move through previewable files without closing the preview or leaving the folder.
- ArrowLeft/ArrowRight shortcuts work while a preview is open.
- Desktop preview windows update the existing preview window instead of opening extra windows.
- Preview actions include copy path, share, download, and open raw file.
- Text preview fetches abort on close/file change, and media/PDF preview elements explicitly unload resources on close/file change.

Why now:

- Volum already has preview windows.
- Improving this is smaller than adding new feature areas and makes daily browsing feel much better.

Reference:

- [File Browser: preview media in an overlay to maintain navigation state](https://github.com/filebrowser/filebrowser/issues/1833)

## Priority 3: Search Result Actions

Large-folder users often search to find one item, then need to share, download, move, rename, or inspect it from the result itself.

Planned work:

- Add context menu support for search results.
- Add share, download, preview, info, rename, copy, move, and trash actions from search results.
- Preserve the search result list after completing an action.
- Make search result paths easy to inspect and copy.

Why now:

- This is a high-value workflow improvement with limited backend risk.
- It reduces the need to navigate back into slow folders.

References:

- [File Browser: performance and sharing from large folders](https://github.com/filebrowser/filebrowser/issues/1689)
- [File Browser: share files/folders from search results](https://github.com/filebrowser/filebrowser/issues/1692)

## Priority 4: Conflict Handling

File operations need clearer duplicate handling, especially for move/copy jobs with many items.

Planned work:

- Show the conflicting filename and destination.
- Add "skip this", "skip all", "replace this", "replace all", and "rename" choices where appropriate.
- Add "skip identical" when size and checksum match.
- Record per-item conflict decisions in the job audit trail.
- Keep existing safe move semantics: copy, verify, then delete.

Why now:

- Volum already has a job engine and conflict policies.
- Better conflict UX makes bulk operations safer without changing the core architecture.

Reference:

- [File Browser: option to skip duplicates when moving](https://github.com/filebrowser/filebrowser/issues/3655)

## Priority 5: Upload Reliability

Upload failures are a common source of trust loss in web file managers, especially with large files, many small files, folder drops, special characters, and reverse proxies.

Planned work:

- Add targeted tests for filenames with special characters.
- Add folder-upload path normalization tests.
- Improve upload retry/resume messaging.
- Verify large upload behavior through reverse proxy path prefixes.
- Avoid leaving zero-byte or partial files after failed uploads.

Why now:

- Volum's backend already verifies size and uses partial files.
- The next step is hardening edge cases and making failures understandable.

References:

- [File Browser: folder upload double slash path bug](https://github.com/filebrowser/filebrowser/issues/5845)
- [File Browser: Chrome crash with many small uploads](https://github.com/filebrowser/filebrowser/issues/3582)
- [File Browser: large upload failures](https://github.com/filebrowser/filebrowser/issues/2931)
- [File Browser: percent sign filename upload issue](https://github.com/filebrowser/filebrowser/issues/5612)
- [File Browser: corrupted FLAC upload](https://github.com/filebrowser/filebrowser/issues/5664)

## Priority 6: Mobile And Responsive Desktop

Dashboard users want layouts that adapt across screens without manually maintaining separate layouts.

Planned work:

- Audit desktop, files, settings, jobs, preview, and service forms at mobile widths.
- Make desktop icon layout predictable on narrow screens.
- Keep touch actions first-class: long-press context menu, drag safety, readable controls.
- Avoid separate mobile-only feature sets unless absolutely necessary.

Why now:

- Volum is a desktop-style app, but it should not break on phones and tablets.
- The app already has touch support, so this is refinement rather than reinvention.

Reference:

- [Homarr: automatic layout for different screen sizes](https://github.com/homarr-labs/homarr/issues/4541)

## Priority 7: Service Health And Notifications

Service tiles benefit from health status, but polling and notifications must avoid noise.

Planned work:

- Keep client-side health polling visibility-aware.
- Add backend-owned health monitoring only when notification delivery is implemented.
- Add per-service health interval and notification toggle only if global defaults are not enough.
- Add down/up transition events instead of notifying on every failed check.
- Support notification channels later: browser notification first, webhook/email only if needed.

Why later:

- A health dot is useful now.
- Alerting becomes product surface area and needs state, rate limiting, and user preferences.

References:

- [Homarr: health checks causing email flood](https://github.com/homarr-labs/homarr/issues/1905)
- [Homepage: service health/API behavior around Radarr](https://github.com/gethomepage/homepage/issues/1142)

## Priority 8: Service Widgets And Integrations

Dashboard users often want integrations, not just links. This should stay constrained in Volum.

Planned work:

- Start with simple service metadata: health, open mode, icon, URL, description.
- Consider optional lightweight widgets for common local services only after the service model stabilizes.
- Prefer generic widgets before service-specific integrations.
- Avoid becoming a full Homarr/Homepage replacement.

Why later:

- Volum's primary product is file management.
- Service widgets are useful, but they can easily expand beyond the app's core.

Reference:

- [Homarr: Beszel integration request](https://github.com/homarr-labs/homarr/issues/2645)

## Not Planned For Now

- Full monitoring suite with alert rules, incidents, retention charts, and escalation policies.
- Native Android/iOS apps.
- Plugin marketplace.
- Multi-board dashboard layout editor.
- Service-specific widget catalog before generic service tiles are mature.

These may become reasonable later, but they do not fit the next focused iteration.
