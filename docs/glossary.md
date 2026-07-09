# Volum Glossary

## Allowed host

A hostname or IP address accepted by the HTTP server's host-header validation.
Configured through `VOLUM_ALLOWED_HOSTS`.

## Audit log

A persisted record of a significant file or conflict-resolution action. Audit
logs live in SQLite and should not contain secrets or internal-only details.

## Conflict policy

The rule used when a destination already exists. Current policies include ask,
skip, overwrite, rename, cancel, and skip-identical where supported.

## Desktop service

A user-configured shortcut shown on the Volum desktop. It may have an optional
health URL checked by the backend.

## Device

A block device or mounted filesystem discovered by the backend and presented
in the drives view. A device is not automatically an allowed root.

## Host root

The internal container path corresponding to the host filesystem, normally
`/host` in server mode. It maps public host paths to their container paths.

## Internal path

The filesystem path used inside the running process/container. Internal paths
must not be returned to the browser.

## Job

A persisted operation with type, status, aggregate progress, and optional
source/destination paths. Copy, move, archive, extract, and checksum jobs are
executed by the background worker.

## Job item

A persisted unit of work inside a job, usually one file. It stores independent
progress, status, temporary path, checksum, error, and conflict resolution.

## Partial file

Temporary output written before an operation is verified and finalized.
Partial state must be cleaned after failure or cancellation unless it is
intentionally retained for resume.

## Public path

The path used by the browser and API, such as `/storage/photos`. `RootGuard`
maps it to an internal path.

## Public URL

The externally visible absolute base URL configured by `VOLUM_PUBLIC_URL`. It
is used for share links and secure-cookie decisions.

## Root

An allowed top-level filesystem location. All user-supplied paths must resolve
inside a configured root.

## RootGuard

The backend security boundary that cleans public paths, maps them to internal
paths, resolves symlink ancestry, enforces allowed roots, and provides guarded
mutation methods on Linux.

## Share

A token-based public download reference with optional password, expiry, and
download limit.

## SSE

Server-Sent Events. Volum uses an authenticated event stream to send complete
job lists and service-health transitions to the frontend.

## Verify mode

The method used to validate operation output before completion, such as size or
checksum verification.

## Workspace page

Full content rendered inside the desktop workspace, such as files, drives,
jobs, trash, search, or settings. It is different from a transient modal or
overlay.
