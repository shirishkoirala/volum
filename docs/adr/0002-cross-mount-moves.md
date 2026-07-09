# ADR 0002: Cross-Mount Moves Use Copy, Verify, Delete

Status: accepted

## Context

Direct rename cannot move files across filesystems. Falling back to an
unverified copy followed by deletion risks data loss.

## Decision

Move operations use the job engine to copy the source to partial destinations,
persist progress, apply conflict policy, verify output, finalize destinations,
and only then delete the source.

## Consequences

- Moves work consistently across mount boundaries.
- Moves take additional time and temporary space.
- Cancellation or failure must retain the source.
- Tests must prove source deletion happens only after successful verification.
