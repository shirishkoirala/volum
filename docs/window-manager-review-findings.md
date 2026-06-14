# Window Manager Branch Review Findings

Review target: `feature/wndow_manager` against `master`

Merge base: `b02a62ec5aba0c1b58d464590643faf11d48b715`

## Findings

### Resolved: P1 conflict resolution never resumes `needs_attention` jobs

File: `backend/internal/api/handlers_jobs.go`

Original line: `366`

`handleResolveConflicts` calls `s.jobs.ResumeJob()` after resolving all conflicting items, but `ResumeJob` only transitions jobs from `paused` to `queued`. Conflict jobs are in `needs_attention`, so `ResumeJob` returns `sql.ErrNoRows`. The error is ignored, the API reports `resumed: true`, and the worker never claims the job because it only claims `queued` jobs.

Resolution: added `ResumeNeedsAttentionJob`, changed conflict resolution to call it, and now handles the returned error before reporting success.

### Resolved: P1 health checker cache has a concurrent map race

File: `backend/internal/desktop/health.go`

Original line: `141`

`checkAll` launches one goroutine per service. Each goroutine reads `hc.cache[svc.ID]` before taking the mutex, while other goroutines write to the same map under the mutex. With multiple services this can panic with concurrent map read/write.

Resolution: the previous-value read and cache update now happen under the same mutex.

### Resolved: P2 health SSE events are consumed by only one client

File: `backend/internal/api/handlers_jobs.go`

Original line: `81`

`HealthChecker.Events()` exposes a single shared channel, and every `/api/jobs/events` connection reads from that same channel. With multiple browser tabs or clients, each health transition is delivered to whichever connection receives from the channel first, so other clients miss the notification.

Resolution: replaced the shared event channel with per-client health event subscriptions and nonblocking fanout.

## Notes

These findings were addressed in the backend conflict-resolution and service-health paths. Focused tests were added for `needs_attention` requeueing and health event fanout.
