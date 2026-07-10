---
title: DRY up cancel/paused check in chunk upload handler
labels: good first issue, area/backend, refactor
---

## Problem

`handleUploadChunk` in `backend/internal/api/upload_chunk.go` repeats the same
cancel-check and paused-check code inline (lines ~530-551). This pattern
appears in several other handlers (`uploadPart`, `processTransfer`). A shared
helper would reduce duplication and make the cancel/pause flow consistent.

## Acceptance criteria

- Create a helper function `checkJobCancelledOrPaused(ctx, jobID) (cancelled,
  paused bool, err error)` in an appropriate shared file.
- Replace the inline cancel/pause check in `handleUploadChunk` with the helper.
- All existing backend tests pass.
- Behavior is unchanged: cancelled jobs return `410 Gone`, paused jobs return
  `409 Conflict` with `{"paused": true}`.

## Likely files

- `backend/internal/api/upload_chunk.go` — replace inline check with helper
- `backend/internal/api/upload_common.go` or `middleware.go` — add the helper

## Suggested test location

`backend/internal/api/handlers_upload_test.go` (existing tests cover this).

## Verification

```sh
make check-backend
# or via Docker:
docker compose -f docker-compose.server.yml build volum
```

## Non-goals

- Do not change the cancel/pause behavior or HTTP status codes.
- Do not refactor the worker's cancel/pause checks in `transfer.go` (different package).

## Follow-up

After this issue, apply the same helper to `uploadPart` in
`upload_multipart.go` and to `processTransfer` in `worker/transfer.go`.
