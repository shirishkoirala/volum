# Add or Modify a Background Job

Background jobs are for filesystem work that must expose progress, survive UI
navigation, support cancellation, or require conflict handling.

Uploads are an exception: API handlers stream upload bytes while recording job
progress. Do not route upload chunks through the polling worker.

## 1. Define the state model

Update `backend/internal/jobs/model.go` when adding a job type or status.
Decide:

- Required source and destination paths
- Valid conflict policies
- Verification mode
- Whether the job supports pause, cancel, retry, and scheduling
- Which item-level state must survive restart

Avoid adding a status when an existing state plus an error or item state is
sufficient.

## 2. Add persistence and claiming

Put job CRUD in `store.go`, item behavior in `store_items.go`, claiming in
`store_claiming.go`, audit behavior in `store_audit.go`, and maintenance in
`store_maintenance.go`.

Claiming must be atomic so two workers cannot run the same job. Multi-step
state changes should use a transaction.

## 3. Implement worker behavior

Add focused execution code under `backend/internal/worker/` and dispatch it
from the worker loop.

Worker rules:

- Resolve paths through `RootGuard` immediately before use.
- Persist the work plan before mutating destinations.
- Use partial files for incomplete output.
- Check context, cancellation, and pause state during long loops.
- Bound buffers and concurrency.
- Apply the selected conflict policy explicitly.
- Verify output before deleting a move source.
- Clean partial state on failure and cancellation.
- Persist useful item and job errors.
- Add audit entries for user-significant decisions.

## 4. Expose API operations

Update `handlers_jobs.go` and route registration for create/control operations.
Apply `requireUser`, `requireAPIRequest`, and `requireAdmin` consistently.

If the existing `POST /api/jobs` request can represent the job, extend it
instead of adding another creation endpoint.

## 5. Update the frontend

Update job types in `frontend/src/api/client.ts`, labels and predicates in
`frontend/src/utils/jobs.ts`, and controls in the jobs page or initiating
workflow.

`frontend/src/hooks/useJobs.ts` consumes full job lists from SSE. Ensure the new
type has:

- A readable action and completion label
- Correct file-refresh behavior
- Appropriate pause, retry, cancel, and conflict controls
- Useful failure text

## 6. Test failure before success

Backend tests should cover:

- Claiming only eligible jobs
- Restart recovery
- Path escape and symlink escape
- Existing destinations under each allowed conflict policy
- Cancellation and pause during work
- Partial write or verification failure
- Cleanup after failure
- Retry behavior
- Move source retained until verification succeeds
- Progress and final state

Frontend tests should cover labels, available controls, status transitions, SSE
updates, and refresh behavior.

## 7. Verify

```sh
make check
make smoke
```

Use disposable nested directories and files. Exercise cancellation and
conflicts manually, not only the successful path.

## Pull request notes

Describe the state machine, crash/restart behavior, conflict semantics,
verification, cleanup guarantees, and any migration.
