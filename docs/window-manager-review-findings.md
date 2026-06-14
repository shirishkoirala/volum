# Window Manager Branch Review Findings

Review target: `feature/wndow_manager` against `master`

Merge base: `b02a62ec5aba0c1b58d464590643faf11d48b715`

## Findings

### P1: Conflict resolution never resumes `needs_attention` jobs

File: `backend/internal/api/handlers_jobs.go`

Line: `385`

`handleResolveConflicts` calls `s.jobs.ResumeJob()` after resolving all conflicting items, but `ResumeJob` only transitions jobs from `paused` to `queued`. Conflict jobs are in `needs_attention`, so `ResumeJob` returns `sql.ErrNoRows`. The error is ignored, the API reports `resumed: true`, and the worker never claims the job because it only claims `queued` jobs.

Recommended fix: add an explicit store method or update path that transitions `needs_attention` jobs back to `queued`, and handle any error from that call before returning success.

### P1: Health checker cache has a concurrent map race

File: `backend/internal/desktop/health.go`

Line: `141`

`checkAll` launches one goroutine per service. Each goroutine reads `hc.cache[svc.ID]` before taking the mutex, while other goroutines write to the same map under the mutex. With multiple services this can panic with concurrent map read/write.

Recommended fix: take the mutex around both the previous-value read and the cache update, or serialize cache mutation after the checks complete.

### P2: Health SSE events are consumed by only one client

File: `backend/internal/api/handlers_jobs.go`

Line: `81`

`HealthChecker.Events()` exposes a single shared channel, and every `/api/jobs/events` connection reads from that same channel. With multiple browser tabs or clients, each health transition is delivered to whichever connection receives from the channel first, so other clients miss the notification.

Recommended fix: implement a broadcast/pub-sub fanout for health transitions, or include health state in the regular SSE jobs tick so every client receives the current state.

## Notes

The reviewed window manager changes are broad, but these three findings are the concrete blockers found in the new conflict-resolution and service-health paths.
