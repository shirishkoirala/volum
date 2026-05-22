# Security

Volum only accesses configured roots from `VOLUM_ROOTS` plus roots explicitly enabled through server mode discovery.

## Path Rules

- Reject empty paths.
- Reject path traversal.
- Resolve symlinks before access when the path exists.
- Confirm the resolved path is inside an allowed root.
- Never expose `/` unless explicitly configured.
- Never trust frontend paths directly.
- Validate all paths through `RootGuard.Resolve` before filesystem access.
- In Docker server mode, map public host paths to internal container paths before filesystem access.

## Roles

- `admin`: browse, upload, download, copy, move, rename, delete, manage jobs, change permissions
- `readonly`: browse, preview, download

Set `VOLUM_AUTH_REQUIRED=true` for Linux server deployment. In that mode, Volum refuses to start without `VOLUM_ADMIN_PASSWORD` and `VOLUM_SESSION_SECRET`.

## Job Engine Safety

- Copy uses `.partial` temp files with size verification before renaming to the final path.
- Move is implemented as copy + verify + delete source (never a direct rename across mounts).
- Conflict policies (ask, skip, overwrite, rename, cancel) are enforced before any filesystem write.
- Archive and extract use rename conflict policy by default.
- All long-running operations run as background jobs — the HTTP request only enqueues the job.
