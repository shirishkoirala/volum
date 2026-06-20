# Volum Security Audit

Date: 2026-06-20

## Executive summary

Volum has useful security foundations, including bcrypt password hashing, HMAC
session signatures, role middleware, parameterized SQL, cryptographically random
share tokens, filesystem root validation, and bounded avatar/chunk uploads.

The application is suitable for development or a trusted private network, but it
should not be exposed directly to the internet yet. The primary release blockers
are server-side request forgery (SSRF), same-origin execution of raw files,
incomplete symlink containment, and production configuration that can disable
authentication while exposing the host filesystem.

## Scope

The review covered:

- Authentication, sessions, setup, users, and authorization
- Filesystem root enforcement and archive processing
- Uploads, downloads, previews, and raw file responses
- Public share links and password protection
- Desktop service shortcuts and health checks
- HTTP server configuration and browser security headers
- Docker development and server deployment configuration
- Frontend content rendering and browser storage
- Go and npm dependency vulnerability scans

This was a source review and targeted runtime/dependency verification, not a
formal penetration test.

## Risk summary

| Priority | Finding | Exposure |
| --- | --- | --- |
| P1 | Health check SSRF | Any authenticated user can make server-side requests |
| P1 | Same-origin raw file execution | Malicious HTML/SVG can act as the viewer |
| P1 | Incomplete symlink containment | Writes can escape configured roots |
| P1 | Unsafe production configuration combination | Host root can be exposed without authentication |
| P2 | Login and initial setup abuse | Brute force and first-user takeover |
| P2 | Sessions cannot be reliably revoked | Stolen tokens survive logout/password changes |
| P2 | Weak share password flow | Password leakage, guessing, and limit races |
| P2 | Unbounded archive extraction | Disk exhaustion through archive bombs |
| P2 | Known dependency vulnerabilities | Vulnerable chi and Vite versions |
| P3 | Missing HTTP hardening | Reduced browser and denial-of-service protection |

## Findings and remediation

### 1. P1: Server-side request forgery in service health checks

Relevant code:

- `backend/internal/api/server.go`
- `backend/internal/api/handlers_services.go`
- `backend/internal/desktop/health.go`

Service mutation endpoints require authentication but not the admin role. The
backend accepts a health URL and performs a GET request without restricting the
destination. Redirects are followed by the default HTTP client. A readonly user
can therefore probe loopback services, private networks, container services, or
cloud metadata endpoints.

Recommended fix:

1. Move service create, update, delete, and reorder routes into the admin group.
2. Parse health URLs on the server and allow only `http` and `https`.
3. Resolve every hostname and reject loopback, private, link-local, multicast,
   unspecified, and reserved addresses.
4. Repeat destination validation after every redirect using `CheckRedirect`.
5. Use a custom `http.Transport.DialContext` so DNS rebinding cannot bypass the
   validation between checking and connecting.
6. Limit response consumption, for example to 64 KiB, instead of copying the
   entire body.
7. Consider an explicit allowlist for deployments that only monitor known hosts.

Acceptance tests:

- A readonly user receives `403` when mutating services.
- URLs targeting `127.0.0.1`, `::1`, RFC1918 ranges, and `169.254.169.254` fail.
- A public URL redirecting to a private address fails.
- Normal public health endpoints continue to work.

### 2. P1: Raw files can execute in the Volum origin

Relevant code:

- `backend/internal/api/handlers_files.go`
- `frontend/src/components/overlay/PreviewModal.tsx`

`/api/files/raw` sends files inline and lets `http.ServeFile` select the content
type. Opening an HTML or active SVG file can execute content under the same
origin as Volum and make authenticated API requests as the viewer.

Recommended fix:

1. Create separate preview and download behavior instead of a general inline raw
   endpoint.
2. Serve text previews as `text/plain; charset=utf-8` with
   `X-Content-Type-Options: nosniff`.
3. Serve unknown, HTML, XML, and SVG content as attachments unless a safe,
   sandboxed renderer is used.
4. Add `Content-Security-Policy: sandbox; default-src 'none'` to any response that
   must display untrusted browser content directly.
5. Sandbox PDF preview iframes and avoid `allow-same-origin` unless required.
6. Open raw/download tabs with `noopener,noreferrer`.

Acceptance tests:

- Opening an uploaded `.html` file downloads it or displays escaped plain text.
- An SVG containing script cannot access `window.parent` or `/api/session`.
- Image, audio, video, text, and PDF previews still render as intended.
- All preview responses include `nosniff` and an appropriate content type.

### 3. P1: Symlink containment does not cover nonexistent descendants

Relevant code:

- `backend/internal/security/paths.go`
- `backend/internal/worker/zip.go`
- `backend/internal/worker/tar.go`
- `backend/internal/worker/worker.go`

`RootGuard.Resolve` evaluates symlinks only when the complete destination exists.
For a new path, an existing parent symlink can escape the configured root.
Archive extraction also performs lexical prefix checks but can follow a symlink
already present beneath the destination directory.

Recommended fix:

1. Resolve and validate the nearest existing ancestor for every destination.
2. Reject symlinks in every destination path component used for writes.
3. During extraction, validate each parent component immediately before opening
   the output file.
4. Use no-follow file operations where supported. On Linux, prefer descriptor-
   relative operations such as `openat2` with `RESOLVE_BENEATH` and
   `RESOLVE_NO_SYMLINKS` for the strongest protection.
5. Reject archive entries that are symlinks, hard links, devices, FIFOs, or other
   non-regular types unless support is explicitly designed.
6. Keep lexical traversal checks, but do not treat them as sufficient containment.

Acceptance tests:

- Extraction to `root/link/new`, where `link` points outside the root, fails.
- An archive entry beneath a pre-existing symlink inside the destination fails.
- ZIP entries containing `../` or absolute paths fail instead of being skipped.
- No file outside the configured root is created or modified.

### 4. P1: Production configuration can expose the host without authentication

Relevant configuration:

- `.env.example`
- `docker-compose.server.yml`
- `Dockerfile`

The example environment disables authentication. Server compose mounts `/` at
`/host` read-write, enables root discovery, publishes on all interfaces, and runs
the container as root. Copying the example file for server deployment can create
a high-impact unauthenticated host file manager.

Recommended fix:

1. Split configuration into `.env.development.example` and
   `.env.server.example`.
2. Set `VOLUM_AUTH_REQUIRED=true` in the server example.
3. Fail startup when host-root mode is enabled without authentication.
4. Require a session secret of at least 32 random bytes and reject placeholder
   values.
5. Bind to `127.0.0.1` by default when a reverse proxy is expected.
6. Mount only required host paths. Make mounts read-only unless write access is a
   deliberate deployment choice.
7. Run as a non-root UID/GID where host filesystem permissions permit it.
8. Document TLS and trusted reverse proxy requirements.

Acceptance tests:

- Server startup fails for `VOLUM_INCLUDE_ROOT=true` with authentication off.
- The documented server setup starts with authentication enabled.
- The default published port is not reachable externally unless explicitly set.

### 5. P2: Login and initial setup lack abuse protection

Relevant code:

- `backend/internal/api/handlers_auth.go`
- `backend/internal/api/handlers_users.go`
- `backend/internal/auth/store.go`

Login and setup have no rate limiting. Password validation only checks that a
value is nonempty. The first public request to `/api/setup` can create the initial
administrator when the database has no users.

Recommended fix:

1. Add rate limits by source IP and normalized username with bounded memory and
   expiry.
2. Add increasing delays or temporary lockouts after repeated failures.
3. Require a reasonable password length, such as 12 characters, while allowing
   long passphrases.
4. Protect initial setup with a one-time bootstrap token supplied through an
   environment variable or printed only to local server logs.
5. Make the first-user check and creation atomic in one transaction.
6. Apply request body size limits before JSON decoding.

Acceptance tests:

- Repeated failed logins receive `429 Too Many Requests`.
- Weak passwords are rejected for setup, user creation, and password changes.
- Setup without the bootstrap token fails.
- Concurrent setup requests can create only one initial administrator.

### 6. P2: Sessions lack expiry and reliable revocation

Relevant code:

- `backend/internal/auth/service.go`
- `backend/internal/api/handlers_auth.go`

Session payloads contain only user ID and role. There is no issued-at time,
expiration, session identifier, or user session version. Logout only removes the
browser cookie, and a password change does not invalidate a copied token.

Recommended fix:

1. Add issued-at and expiry timestamps to signed session claims.
2. Add a per-user `session_version` stored in the database and include it in the
   token.
3. Increment the version on password changes, administrative revocation, and a
   "log out all sessions" action.
4. Use short expiration for normal sessions and the existing seven-day duration
   only for remembered sessions.
5. Set `Secure` in HTTPS deployments. Keep `HttpOnly` and `SameSite=Lax` or use
   `Strict` if workflows permit it.
6. Rotate session secrets through an explicit operational procedure.

Acceptance tests:

- Expired tokens are rejected.
- Changing a password invalidates all prior tokens for that user.
- A revoked session version is rejected even when its HMAC remains valid.
- Production cookies include `Secure`, `HttpOnly`, and `SameSite`.

### 7. P2: Share password and download-limit controls are weak

Relevant code:

- `backend/internal/api/handlers_shares.go`
- `backend/internal/shares/service.go`

Share passwords are passed in query parameters and stored as unsalted SHA-256.
Query parameters can appear in browser history and proxy logs. Password attempts
are unlimited, and the maximum-download check and increment are separate database
operations, allowing concurrent requests to exceed the limit.

Recommended fix:

1. Use a POST unlock endpoint and exchange the password for a short-lived,
   share-scoped HttpOnly cookie or signed access token.
2. Hash share passwords with bcrypt or Argon2id.
3. Compare derived values in constant time where applicable.
4. Rate-limit failures by share token and source address.
5. Atomically reserve a download with one conditional SQL update:
   `UPDATE ... SET download_count = download_count + 1 WHERE ...` including the
   enabled, expiry, and maximum constraints.
6. Validate `MaxDownloads` as a positive bounded value.
7. Use `mime.FormatMediaType` for safe `Content-Disposition` filenames.

Acceptance tests:

- Share passwords never appear in URLs.
- Repeated incorrect passwords are throttled.
- Concurrent requests cannot exceed the configured maximum download count.
- Expired or disabled shares cannot reserve a download.

### 8. P2: Archive extraction has no resource limits

Relevant code:

- `backend/internal/worker/zip.go`
- `backend/internal/worker/tar.go`

Extraction has no maximum expanded size, entry count, per-file size, compression
ratio, or destination free-space check. A small archive can consume all available
storage.

Recommended fix:

1. Define configurable limits for total expanded bytes, entries, path depth, and
   per-entry bytes.
2. Reject ZIPs whose declared totals exceed limits before extraction.
3. Wrap every reader with a counting/limited reader because declared sizes cannot
   be trusted.
4. Check available destination space before and during extraction.
5. Stop and remove files produced by a failed extraction.
6. Record a clear audit event when a limit rejects an archive.

Acceptance tests:

- High-ratio ZIP and TAR fixtures stop at the configured byte limit.
- Excessive entry counts and deeply nested paths are rejected.
- Partial output is cleaned after cancellation or limit failure.

### 9. P2: Known dependency vulnerabilities

The scans found:

- `github.com/go-chi/chi/v5@v5.2.1`: `GO-2025-3770`, fixed in `v5.2.2`.
- Vite `<=6.4.2`: high-severity Windows development-server advisories reported
  by `npm audit`.

Recommended fix:

1. Upgrade chi to at least `v5.2.2` and run all backend tests.
2. Upgrade Vite and its React plugin to compatible patched versions.
3. Replace `npm install` with `npm ci` in Docker builds for lockfile fidelity.
4. Add `govulncheck ./...` and `npm audit` to scheduled CI security checks.
5. Keep the Vite dev server off untrusted networks.

### 10. P3: HTTP server and browser headers need hardening

Relevant code:

- `backend/internal/api/server.go`
- `backend/cmd/volum/main.go`

Runtime verification showed no CSP, `X-Content-Type-Options`, frame restriction,
referrer policy, or permissions policy. The HTTP server only configures a header
read timeout.

Recommended fix:

1. Add middleware for:
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: no-referrer`
   - `Permissions-Policy` disabling unused browser features
   - A CSP tailored to the Vite production bundle
   - `frame-ancestors 'none'` unless embedding Volum is required
2. Add `ReadTimeout`, `WriteTimeout`, `IdleTimeout`, and `MaxHeaderBytes`.
3. Treat SSE separately so the normal write timeout does not terminate streams.
4. Apply `Cache-Control: no-store` to authentication and sensitive metadata
   responses.
5. Validate `Host` or configure an explicit public origin behind the proxy.

## Recommended implementation order

### Phase 1: Internet-exposure blockers

1. Disable readonly service mutations and implement SSRF-safe health checks.
2. Isolate raw and preview responses from the application origin.
3. Make write and extraction paths symlink-safe.
4. Make server configuration fail closed when host root access is enabled.

### Phase 2: Account and sharing controls

1. Add login throttling, password policy, and protected setup.
2. Add expiring, revocable sessions and secure cookie configuration.
3. Redesign password-protected share access and atomic download accounting.

### Phase 3: Defense in depth

1. Add archive resource limits and cleanup.
2. Upgrade dependencies and automate vulnerability scans.
3. Add browser security headers and complete HTTP timeouts.
4. Reduce container and mount privileges.

## Existing strengths to preserve

- Passwords use bcrypt rather than reversible encryption.
- Session signatures use HMAC-SHA256 and constant-time verification.
- Session cookies are already HttpOnly and SameSite.
- Share tokens use 32 bytes of cryptographic randomness.
- SQL values are parameterized.
- File mutation routes generally require the admin role.
- Avatar uploads validate byte size, detected MIME type, and dimensions.
- Chunk uploads bound individual request size and verify final file size.
- Existing-path symlink escapes are rejected by `RootGuard`.
- Docker builds run frontend tests/build plus Go vet and Go tests.

## Verification performed

- `docker compose -f docker-compose.dev.yml build`
- `npm audit --omit=dev --audit-level=low` through Docker
- `govulncheck ./...` through a Go 1.25 Docker image
- Runtime response-header inspection from the Docker network
- Manual route, authorization, filesystem, upload, share, preview, and deployment
  review

No exploit payloads were executed against user data during this review.
