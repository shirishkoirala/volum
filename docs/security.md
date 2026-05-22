# Security

Volum only accesses configured roots from `VOLUM_ROOTS` plus roots explicitly enabled through server mode discovery.

## Path Rules

- Reject empty paths.
- Reject path traversal.
- Resolve symlinks before access when the path exists.
- Confirm the resolved path is inside an allowed root.
- Never expose `/` unless explicitly configured.
- Never trust frontend paths directly.
- In Docker server mode, map public host paths to internal container paths before filesystem access.

## Roles

Roles:

- `admin`: browse, upload, download, copy, move, rename, delete, manage jobs
- `readonly`: browse, preview, download

Set `VOLUM_AUTH_REQUIRED=true` for Linux server deployment. In that mode, Volum refuses to start without `VOLUM_ADMIN_PASSWORD` and `VOLUM_SESSION_SECRET`.
