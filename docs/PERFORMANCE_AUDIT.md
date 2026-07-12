# Volum Performance Audit

**Date:** 2026-07-12  
**Scope:** Backend jobs/filesystem/SQLite paths, frontend rendering and network behavior, production static delivery  
**Method:** Static hot-path review, production bundle inspection, Docker resource sampling, response-header checks, and targeted asset conversion trials

## Executive summary

Volum's idle footprint is healthy: the API container used about **0.59% average CPU** and **17.5–18 MiB RAM** with one browser connected. The JavaScript bundle is also reasonable at about **141 KB gzip**, so React code splitting is not currently a priority.

The highest-value remaining work is I/O related:

1. Directory listings synchronously scan inside every visible subdirectory to calculate sizes.
2. Search performs uncancelled full-root walks and can issue duplicate/overlapping searches.
3. Resumable upload uses 1 MiB chunks, causing one HTTP request, file sync, status check, and progress write per MiB.
4. Archive and directory-checksum jobs query SQLite for control/progress state per filesystem entry.
5. Production ships large PNG wallpapers and serves static assets without compression or explicit cache policy.

These should be fixed before adding worker pools, a search index, additional caches, or more SQLite connections.

## Measured baseline

| Measurement | Current value |
|---|---:|
| Production `dist` files | 92 |
| Production `dist` raw bytes | 9,756,926 bytes |
| JavaScript | 482,438 raw / 140,570 gzip |
| CSS | 135,181 raw / 23,217 gzip |
| PNG assets | 6,172,202 bytes |
| SVG assets | 2,799,127 bytes |
| Fonts | 160,636 bytes |
| Approximate dark-desktop bootstrap before API traffic | 1.9 MB plus selected fonts |
| Production Docker image | 49 MB |
| Idle API CPU, five samples | 0.47–0.84%; ~0.59% average |
| Idle API memory | 17.5–18 MiB |

The measured production JS, CSS, and wallpaper responses had no `Content-Encoding` or explicit `Cache-Control`; only `Last-Modified` was present.

The checked `dist` was slightly older than the current dirty frontend worktree, so hashes and a few bytes may change on the next build. The magnitude and asset composition are still representative.

## Improvements already completed

The 2026-07-11 performance work should be treated as the baseline, not reopened:

- Multipart upload progress writes are throttled to 16 MiB or 500 ms.
- Copy-job status checks use one query and are throttled to 300 ms.
- Job SSE skips full list serialization when the list version is unchanged.
- Job claiming has a composite claim index.
- File pages preserve backend ordering instead of sorting again in React.
- Large folders render incrementally rather than mounting every entry immediately.
- Thumbnails are visibility-gated, GIF thumbnails are skipped, and preview size limits exist.

## High-priority findings

### H1. Directory listing calculates subdirectory sizes synchronously

**Evidence:** `backend/internal/files/service.go:112-180`, `backend/internal/files/service.go:442-460`, `backend/internal/files/cache.go`

`ListPage` reads and sorts the complete directory, then calls `immediateDirSize` for every directory in the requested page. That helper reads each child directory and stats each immediate file. A page containing hundreds of large subdirectories can therefore perform hundreds of additional directory scans before returning.

The `DirSizeCache` does not help: production creates it, but there is no call to `Set` anywhere outside tests. Every lookup is therefore a miss.

**Minimal fix:**

1. Stop calculating directory sizes during normal listing; return `0`/unknown and display an em dash for folders.
2. Calculate folder size only from explicit Info or Disk Usage actions.
3. Remove the unused directory-size cache after callers no longer depend on it.
4. Align the backend page size with the UI batch: change `FILE_PAGE_SIZE` from 600 to 240.

Do not add directory watchers or a persistent size index until an explicit folder-size feature needs them.

**Definition of done:**

- Benchmark first-page listing for directories containing 1k, 10k, and 100k entries.
- Listing work must not increase with the contents of child directories.
- First-page metadata work should be capped at 240 entries.
- Record p50/p95 response time and allocation counts in a Go benchmark.

### H2. Search launches uncancelled full-root filesystem walks

**Evidence:** `backend/internal/files/service.go:463-510`, `frontend/src/hooks/useFileBrowser.ts:121-129`, `frontend/src/pages/FilesView.tsx:510-520`, `frontend/src/pages/SearchResultsView.tsx:82-106`

Every search request walks configured roots from the beginning. The quick search fires after 200 ms and does not abort the previous request. The full Search Results view runs one immediate request for `initialQuery`, then its query effect runs the same search again 200 ms later. Older requests can also finish after newer ones and overwrite current results.

**Minimal fix:**

1. Remove the separate `initialQuery` effect; let the query effect make the single request.
2. Extend the shared API request helper/search function to accept an `AbortSignal`.
3. Abort the previous search when the query changes or the component unmounts.
4. Pass `r.Context()` into the backend search and stop `WalkDir` when it is cancelled.
5. Increase debounce to 400 ms only if measurement shows 200 ms still creates excessive walks.

Do not build a search index yet. Add one only if cancellable walks still miss the product's latency target on representative storage.

**Definition of done:**

- Opening Search Results produces one request, not two.
- Only one search remains active per view.
- A superseded request stops filesystem work promptly.
- Benchmark no-match and early-match queries on 10k and 100k entry trees.

### H3. Resumable uploads perform durable work every 1 MiB

**Evidence:** `frontend/src/utils/upload.ts:8,57-75`, `backend/internal/api/upload_chunk.go:93-170,226-235`, `backend/internal/api/upload_common.go:19`

The client sends 1 MiB chunks. For each chunk, the backend reads the full chunk into memory, queries cancelled and paused state separately, opens the partial file, writes at an offset, calls `fsync`, closes it, and updates job progress. A 1 GiB upload therefore requires roughly 1,024 HTTP requests and 1,024 file syncs.

**Minimal fix:**

1. Increase client chunks and the server limit to 8 MiB.
2. Replace the two state lookups with the existing `GetJobStatus` query.
3. Keep one `fsync` per chunk so crash recovery remains bounded to one chunk.
4. Keep progress updates per chunk; the larger chunk already cuts them eightfold.

**Definition of done:**

- Compare 1 GiB upload throughput and CPU using 1 MiB versus 8 MiB chunks.
- Confirm pause, cancel, retry, and resume at non-zero offsets.
- Verify interrupted uploads lose at most one 8 MiB chunk after a forced server stop.
- Keep concurrent-upload memory bounded and document the chosen maximum.

### H4. Archive and checksum jobs query/write SQLite per entry

**Evidence:** `backend/internal/worker/walk.go:11-41`, `backend/internal/worker/checksum.go:83-163`, `backend/internal/worker/zip.go:15-52,95-140`, `backend/internal/worker/tar.go:16-49,100-166`

`walkWithJobControl` performs separate cancelled and paused queries for every path. Zip/tar extraction repeats the pattern for every archive entry. Directory checksum walks the tree once to count, walks it again to hash, performs two status queries per file, inserts one item, and updates job progress per file.

With the deliberate single SQLite connection, small-file workloads spend avoidable time serializing filesystem work through the database.

**Minimal fix:**

1. Reuse one `GetJobStatus` check, throttled to about 300 ms, across archive/extract/checksum loops.
2. Throttle aggregate progress updates to 500 ms while keeping final progress exact.
3. Change directory checksum to one walk; allow totals to be unknown/growing until completion instead of pre-walking solely for a count.
4. Keep per-file checksum items for persistence; batch them only after benchmarks show inserts remain material.

**Definition of done:**

- Add benchmarks for archive and checksum on 1k, 10k, and 100k small files.
- Control-state query rate should remain bounded by time, not entry count.
- Pause/cancel response should remain below 1 second.
- Final item/byte totals and resumability must remain correct.

## Medium-priority findings

### M1. Production static files are neither compressed nor explicitly cached

**Evidence:** `backend/internal/api/server.go:189-202`

The standalone Go server returns the 482 KB JS and 135 KB CSS uncompressed. Their measured gzip sizes are about 141 KB and 23 KB. Hashed `/assets/` files also lack an immutable cache policy.

**Minimal fix:**

- Add compression only to static JS/CSS/SVG/font responses, or document equivalent reverse-proxy compression.
- Set hashed `/assets/` responses to `Cache-Control: public, max-age=31536000, immutable`.
- Keep `index.html` on `no-cache` so deployments are discovered promptly.
- Do not buffer or broadly compress the SSE endpoint.

**Definition of done:**

- `curl --compressed` receives compressed JS/CSS/SVG.
- A repeat request for a hashed asset can be satisfied from cache.
- SSE continues flushing events immediately.

### M2. Wallpaper PNGs dominate initial transfer and image footprint

**Evidence:** `frontend/public/background*.png`

The four wallpapers total 5,708,256 bytes. A WebP quality-82 trial produced 96,116 bytes total, a **98.3% reduction**:

| Asset class | PNG total | WebP trial total |
|---|---:|---:|
| Four wallpapers | 5,708,256 bytes | 96,116 bytes |

**Minimal fix:** Convert the four wallpapers to WebP, update CSS references, and visually compare light/dark desktop and mobile crops before removing the PNGs.

**Definition of done:**

- Visual comparison passes at desktop and 390×844 mobile widths.
- Total wallpaper bytes remain below 250 KB.
- No layout or theme flash is introduced.

### M3. Transfers opens a second job SSE subscription

**Evidence:** `frontend/src/screens/Home.tsx:81-89`, `frontend/src/pages/JobsPage.tsx:158-178`

Home already subscribes for desktop/taskbar badges and notifications. Opening Transfers mounts another `useJobs`, causing an additional initial job fetch and SSE connection. Each server connection performs its own one-second list-version query.

**Minimal fix:** Keep one subscription in Home. Pass `browser.jobs` and the returned job actions into `JobsPage` instead of creating local job state and another subscription.

**Definition of done:** One browser tab maintains exactly one `/api/jobs/events` connection regardless of whether Transfers is open, minimized, or closed.

### M4. SSE still polls SQLite once per second per connection

**Evidence:** `backend/internal/api/handlers_jobs.go:47-63,90-104`, `backend/internal/jobs/store.go:68-102`

The list-version check avoids repeated serialization, but `COUNT(*)` plus `MAX(updated_at)` still runs every second for every connection. Job list reads also sort by `created_at` without a matching index. This is acceptable for today's single-user footprint, but cost grows with clients and retained job history.

**Minimal fix now:**

- Eliminate the duplicate frontend connection first.
- Add an index supporting `ORDER BY created_at DESC` if job-history benchmarks show sorting cost.
- Keep job pruning documented and easy to run.

**Only if measured later:** Replace per-client database polling with one process-wide revision poll or publish/subscribe signal shared by all SSE clients.

**Definition of done:** Load-test 1, 10, and 50 SSE clients with 200, 10k, and 100k retained jobs; record API CPU and SQLite query latency.

### M5. Thumbnails copy full image bodies into JavaScript blobs

**Evidence:** `frontend/src/components/ui/FileItem.tsx:35-97`, `frontend/src/utils/preview.ts`

Visible thumbnails fetch the original image, buffer it as a `Blob`, create an object URL, and then decode it in `<img>`. The visibility and 8 MiB limits help, but the blob path still duplicates browser memory and adds lifecycle code.

**Minimal fix:** On intersection, set `src` directly to `rawUrl(entry.path)` and let the browser stream, cache, decode, and cancel the image. Keep the current visibility gate and size policy. Add a real resized-thumbnail endpoint only if full-image transfer remains a measured bottleneck.

**Definition of done:** Compare heap usage and repeat-navigation network transfer for a folder with 100 representative images.

### M6. Disk Usage Analyzer performs a synchronous recursive scan

**Evidence:** `backend/internal/files/service_disk.go:19-98`

The analyzer recursively stats a tree to depth four during one HTTP request. It limits returned children only after scanning and sorting them, so large trees can hold the request open for a long time.

**Minimal fix:** Add request-context cancellation first. If representative scans exceed a few seconds, move analysis into the existing persistent-job mechanism rather than adding a new ad-hoc worker.

## Low-priority cleanup and guardrails

### L1. README-only logo is shipped in the app

`frontend/public/volum_logo_full.png` is 434,832 bytes and is referenced by the README, not the application. Move it to `docs/` so Vite does not copy it into production.

### L2. Minimized windows remain mounted

`frontend/src/components/window/WindowHost.tsx:16-22` renders every desktop window. `WindowFrame` hides minimized windows with CSS, so their hooks and live subscriptions remain active. Sharing the single jobs subscription resolves the main known cost. Do not broadly unmount windows unless profiling shows other minimized views consuming meaningful CPU; preserving window state is useful behavior.

### L3. There are no performance budgets or repeatable benchmarks

The repository has extensive functional tests but no Go benchmarks, Web Vitals/Lighthouse checks, load tests, or bundle budgets.

Add small, dependency-free guardrails:

- Go benchmarks for listing, search, archive, and checksum using generated trees.
- CI checks for JS gzip size, CSS gzip size, total public image bytes, and production image size.
- A documented manual smoke profile for 1k/10k/100k entry folders and 1/10/50 SSE clients.

## Recommended implementation order

1. Convert wallpapers and move the README-only logo.
2. Add scoped static compression and immutable caching.
3. Stop computing folder sizes during listing; use 240-entry pages.
4. Increase resumable upload chunks to 8 MiB and consolidate status checks.
5. Deduplicate/cancel search and honor request cancellation in the backend.
6. Throttle archive/checksum control and progress database access.
7. Share the single jobs SSE subscription with Transfers.
8. Add benchmarks and size budgets before attempting larger architectural changes.

## Deliberately not recommended yet

- **React route/code splitting:** 141 KB gzip JS is reasonable and no runtime profile identifies parsing as the bottleneck.
- **More SQLite connections or WAL tuning:** the single connection is an intentional reliability choice; current idle resource use is low.
- **Parallel filesystem workers:** concurrent copy/archive/checksum jobs may reduce latency but can lower total disk throughput and complicate ordering.
- **A persistent search index:** cancellation and request deduplication are much cheaper first steps.
- **A directory watcher/cache hierarchy:** normal listing should avoid folder-size scans instead of caching them.
- **A custom thumbnail service:** use direct browser image URLs first, then measure transfer cost.

## Success targets

The first optimization pass is complete when:

- Initial dark-desktop transfer is below 500 KB on a warm font cache.
- Hashed assets are compressed and immutable-cacheable.
- Listing a directory does no work inside its child directories.
- Search never has more than one active walk per view and cancels promptly.
- 1 GiB upload uses roughly 128 requests at 8 MiB chunks instead of 1,024.
- Archive/checksum SQLite control queries are time-bounded rather than entry-bounded.
- One browser tab owns one job SSE connection.
- Benchmarks and bundle budgets make regressions visible in CI.
