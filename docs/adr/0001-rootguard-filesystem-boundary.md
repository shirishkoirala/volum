# ADR 0001: RootGuard Is the Filesystem Boundary

Status: accepted

## Context

Volum accepts paths from browsers and may map host paths into a container.
Cleaning strings alone does not prevent symlink escapes or paths outside
configured storage.

## Decision

Every user-supplied filesystem path is resolved through `RootGuard`.
Filesystem mutations use guarded methods that operate relative to configured
roots and reject unsafe symlink traversal.

Handlers and workers must not bypass this boundary with raw path mutations.

## Consequences

- Public and internal paths remain distinct.
- Path and symlink escape tests are required for filesystem changes.
- Linux provides the supported mutation implementation using descriptor-based
  operations.
- Non-Linux native builds may read supported paths but return
  `ErrUnsupportedMutation` for guarded mutations.
