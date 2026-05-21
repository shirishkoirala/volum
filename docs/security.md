# Security

Volum only accesses configured roots from `VOLUM_ROOTS`.

## Path Rules

- Reject empty paths.
- Reject path traversal.
- Resolve symlinks before access when the path exists.
- Confirm the resolved path is inside an allowed root.
- Never expose `/` unless explicitly configured.
- Never trust frontend paths directly.

## Roles

The planned MVP roles are:

- `admin`: browse, upload, download, copy, move, rename, delete, manage jobs
- `readonly`: browse, preview, download

Authentication is planned after the file and job foundations are stable.
