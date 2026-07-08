# Volum Security Audit

**Date:** 2026-07-03
**Scope:** Backend (`backend/`) — path traversal, authentication/sessions, injection, DoS
**Auditors:** Automated review via parallel code investigation

## Summary

The Volum backend is, on the whole, unusually well-defended for a file-management application: kernel-level `openat2` path containment on Linux, HMAC-signed stateless sessions, bcrypt password hashing, fully parameterized SQL, a hardened SSRF dialer that re-resolves and re-checks IPs at connect time, and robust zip/tar-bomb defenses.

All findings are remediated or explicitly accepted for the current single-tenant model.

| Severity | Count |
|----------|-------|
| 🔴 High | 2 resolved |
| 🟡 Medium | 4 resolved |
| 🟢 Low | 7 resolved, 1 accepted |

---

## 🔴 High Severity

### H1. Auth can be silently disabled, exposing full admin access unauthenticated — ✅ RESOLVED

**File:** `backend/cmd/volum/main.go:57-68`, `backend/internal/auth/service.go:84-87`, `backend/internal/config/config.go:49,67-69`

**Status:** Resolved. `VOLUM_AUTH_REQUIRED` now defaults to `true` (`config.go:49`), and disabling auth requires the explicit opt-in `VOLUM_ALLOW_INSECURE_AUTH_DISABLED=true` (`config.go:67-69`) — the server refuses to start otherwise.

**Original finding (for reference):**

When `VOLUM_AUTH_REQUIRED` is unset/false, `auth.New(nil, "")` runs with `enabled: false`, and `UserFromRequest` returns `RoleAdmin` for **every** request:

```go
func (s *Service) UserFromRequest(r *http.Request) (User, bool) {
	if !s.enabled {
		return User{Role: RoleAdmin}, true   // every caller is admin
	}
```

The server listens on `:8090` (all interfaces). An operator who sets `VOLUM_ROOTS=/` but forgets `VOLUM_AUTH_REQUIRED=true` exposes `DELETE /api/files`, `POST /files/upload`, `PATCH /files/permissions`, `POST /db/vacuum`, etc. with **no authentication** to anyone who can reach the port.

**Attack scenario:** Operator deploys with `VOLUM_ROOTS=/` (or a sensitive directory) but omits `VOLUM_AUTH_REQUIRED`. The server exposes all mutating endpoints unauthenticated to anyone who can reach port 8090.

**Fix:** Default `AuthRequired` to `true`, or refuse to start without an explicit opt-in to insecure mode.

---

### H2. Non-Linux (macOS/Windows) RootGuard lacks `openat2`/`O_NOFOLLOW` — symlink TOCTOU escape — ✅ RESOLVED

**File:** `backend/internal/security/mutate_other.go:11-75`, `backend/internal/security/paths.go:138-168`

**Status:** Resolved by fail-closed gating. Linux keeps the hardened `openat2` mutation implementation; native non-Linux builds now return `ErrUnsupportedMutation` for filesystem mutation methods instead of using the weaker `Resolve` + `os.*` fallback.

**Original finding (for reference):**

The Linux build (`mutate_linux.go`) uses `openat2(RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS)` + `O_NOFOLLOW` — robust at the syscall level. The non-Linux build uses plain `os.OpenFile`/`os.Rename`/`os.RemoveAll` after `Resolve`:

```go
func (g *RootGuard) OpenFile(path string, flags int, perm os.FileMode) (*os.File, error) {
	resolved, err := g.Resolve(path)
	if err != nil { return nil, err }
	return os.OpenFile(resolved, flags, perm)   // no O_NOFOLLOW, no RESOLVE_BENEATH
}
```

`Resolve` only `EvalSymlinks` the nearest *existing* ancestor (`paths.go:138-168`), so a not-yet-existing symlinked parent isn't caught at resolve time. An attacker who can create a symlink inside a root (e.g., via an archive, or any future feature) can race the window between `Resolve` returning and `os.OpenFile` executing to escape containment.

**Note:** Per `AGENTS.md`, Go is not run locally and production runs in Docker (Linux). This is primarily a dev-deployment risk on macOS.

**Fix:** Port `O_NOFOLLOW`-on-final-component + open-parent-by-fd semantics to `mutate_other.go`, or gate mutation endpoints to Linux-only.

---

## 🟡 Medium Severity

### M1. No CSRF protection beyond `SameSite=Lax` — ✅ RESOLVED

**File:** `backend/internal/api/handlers_auth.go:80`, `backend/internal/api/middleware.go`

**Status:** Resolved. Authenticated unsafe API methods now require `X-Volum-Request: fetch`; requests with an `Origin` header must match the request host; session cookies now use `SameSite=Strict`; the frontend API client sends the marker header for JSON, multipart avatar upload, and upload chunks.

**Original finding (for reference):**

The session cookie uses `SameSite=Lax`, which blocks cross-site POST forms but allows top-level GET navigations and offers no defense against same-site subdomain attacks. There is **no CSRF token**, no custom-header check, and no `Origin`/`Referer` validation. Several mutating endpoints use non-POST methods (`DELETE /api/files`, `PATCH /files/rename`, `PUT /favorites/reorder`) that a sibling subdomain could trigger.

**Attack scenario:** A victim admin visits an attacker page on a sibling subdomain; the page issues `DELETE /api/files?path=...` or `PATCH /api/users/{id}/role` via fetch. With Lax, the session cookie is sent on same-site requests, allowing the action.

**Fix:** Add a synchronizer token, or enforce `X-Requested-With` + strict `Origin` checks on non-GET `/api/` requests. Consider `SameSite=Strict` for the session cookie.

---

### M2. Missing request body size limits on 12 admin JSON endpoints (DoS) — ✅ RESOLVED

**Files:**
- `handlers_files.go:117,135,153,174,203,363`
- `handlers_services.go:45,75,146`
- `handlers_users.go:125`
- `handlers_jobs.go:104,286`

**Status:** Resolved. The affected JSON handlers now decode through a shared `MaxBytesReader`-backed helper with a 1 MB cap. Array endpoints now explicitly cap request item counts at `maxJSONItems` (1000).

**Original finding (for reference):**

These handlers decode JSON with no `http.MaxBytesReader`, unlike the auth handlers which correctly cap at 1 MB. The worst are array-accepting endpoints:
- `handleBatchRename` (`[]batchRenameItem`, unbounded)
- `handleReorderServices` / `handleReorderFavorites` (`[]string`, unbounded)
- `handleResolveConflicts` (`resolveRequest.Items`, unbounded)

A multi-GB JSON body forces full in-memory decode before validation. The 30s `ReadTimeout` is a soft ceiling but doesn't bound buffered bytes.

**Attack scenario:** An authenticated admin (or any client when `VOLUM_AUTH_REQUIRED=false`) sends a multi-GB JSON array to `POST /api/files/batch-rename` or `POST /api/jobs/{id}/resolve`. The JSON decoder allocates the full structure in memory before validation runs, exhausting RAM.

**Fix:** Apply `http.MaxBytesReader` to the admin group (or each handler), and bound slice lengths explicitly.

---

### M3. Session fixation / no revocation granularity — ✅ RESOLVED

**File:** `backend/internal/auth/service.go:63-82` (Login), `backend/internal/auth/store.go:176-185` (UpdateRole)

**Status:** Resolved. Successful login rotates `SessionVersion`, role changes increment `SessionVersion`, and admins have `POST /api/users/{id}/revoke-sessions` for explicit revocation.

**Original finding (for reference):**

`Login` does **not** bump `SessionVersion`, so a pre-existing stolen token remains valid after the victim re-logs in. `UpdateRole` does **not** bump `SessionVersion` either — a demoted admin keeps an admin-embedded token (mitigated only by `UserFromRequest` re-checking `record.Role == claims.role` at lookup time, but the token isn't revoked). There's no admin "revoke all sessions" action.

**Attack scenario:** An attacker obtains a long-lived "remember me" token (7 days). The victim notices and re-logs in, but the stolen token remains valid because `SessionVersion` was not bumped. Only a password change invalidates it.

**Fix:** Bump `SessionVersion` on role change and on login; add an admin revocation endpoint.

---

### M4. App-bundle zip extraction uses string-prefix containment on all platforms — ✅ RESOLVED

**File:** `backend/internal/api/handlers_upload_app.go:76-136, 193-197`

**Status:** Resolved via H2. App-bundle extraction still uses `RootGuard` mutation methods, but non-Linux native mutation now fails closed. Linux remains protected by `openat2`/`O_NOFOLLOW`.

**Original finding (for reference):**

Unlike the worker's `extractZip` (which uses `openat2`/`O_NOFOLLOW` on Linux and is disabled elsewhere), the `.app.zip` auto-extraction runs on **every** platform via `s.guard.CreateFile`/`MkdirAll`, with containment checked only by the local string-prefix `withinDirectory`:

```go
func withinDirectory(root, target string) bool {
	root = filepath.Clean(root)
	target = filepath.Clean(target)
	return target == root || strings.HasPrefix(target, root+string(filepath.Separator))
}
```

The check is correct as written (rejects `../`), but combined with H2 (non-Linux guard weakness), a pre-placed symlink in `tempDir` could be followed on macOS. Defense-in-depth gap.

**Fix:** Reuse the hardened `openExtractFile`/`openExtractDirs` path instead of the local `withinDirectory` string check, or restrict app-bundle extraction to Linux.

---

## 🟢 Low Severity

### L1. Bootstrap token logged in plaintext to stdout — ✅ RESOLVED

**File:** `backend/cmd/volum/main.go:79-86`

**Status:** Resolved. Generated setup tokens are written to `volum-initial-setup-token` beside the configured DB with mode `0600`; logs include only the token file path.

Auto-generated setup token written to structured logs as a `"token"` field, visible to log aggregators/container runtimes. Anyone with the token can create the initial admin account.

**Fix:** Print a reference to a file or require explicit env config; avoid logging the raw token.

---

### L2. Login rate limiter is per-IP only, no per-account lockout — ✅ RESOLVED

**File:** `backend/internal/api/ratelimit.go:78-82`

**Status:** Resolved. Login throttling now applies IP, username-only, and IP+username buckets.

20 logins/min per IP; trivially bypassed by rotating source IPs (botnet, IPv6 `/64` spread). No account-level throttle or progressive backoff. bcrypt at cost 10 allows ~50-100 attempts/sec per core, so distributed brute force of weak passwords is feasible.

**Fix:** Add per-account throttling independent of source IP.

---

### L3. `NextAvailablePath` is a pure path-string helper with no containment check — ✅ RESOLVED

**File:** `backend/internal/security/paths.go:301`, `backend/internal/api/handlers_jobs.go:356`

**Status:** Resolved. Filesystem call sites now use `RootGuard.NextAvailablePath`, which validates the input path and generated candidate remain under the configured internal root.

Safe today only because all callers re-`Resolve` the result before filesystem use. Latent gap: if any future code consumes the return value without re-resolving, it becomes exploitable.

**Fix:** Add a containment assertion inside `NextAvailablePath`, or document the contract loudly.

---

### L4. `cleanPublicInput` doesn't explicitly reject NUL/control bytes — ✅ RESOLVED

**File:** `backend/internal/security/paths.go:258`

**Status:** Resolved. Public paths and base names now reject NUL, ASCII control characters, and DEL before normalization/resolution.

Go's `os` layer rejects NUL on Linux/macOS today, so not directly exploitable. Defense-in-depth gap if paths ever reach a C interop or shell layer.

**Fix:** Explicitly reject any input containing `\x00` (and ideally other control chars) in `cleanPublicInput`.

---

### L5. `handleDownload`/archive-write/checksum follow symlinks on read of in-root paths — ✅ RESOLVED

**File:** `backend/internal/files/service.go:368-399`, `backend/internal/worker/walk.go:29-31`, `backend/internal/worker/checksum.go:34-37,89,116,167-172`, `backend/internal/api/handlers_files.go:241-282`

**Status:** Resolved. `DownloadPath` and `ThumbnailPath` reject symlinks via `os.Lstat` + `ErrSymlinkRead`. Worker archive creation skips symlink entries in `walkWithJobControl` (`walk.go:29-31`). Checksum jobs reject symlinks at `hashFile` and during directory walks. The `handleDownload` directory-zip path now skips symlink entries before opening files.

**Residual note:** `handleDownload`'s directory-zip `WalkDir` originally used raw `os.Open` without a symlink check — a symlinked *file* inside a downloaded directory would have been followed, leaking out-of-root contents into the zip. This is now closed by skipping `ModeSymlink` entries. `filepath.WalkDir` already does not recurse into symlinked *directories*. The app exposes no symlink-creation endpoint, so this was a defense-in-depth gap.

---

### L6. No explicit aggregate body cap on `handleUpload` multipart — ✅ RESOLVED

**File:** `backend/internal/api/handlers_upload.go:23`

**Status:** Resolved. Multipart uploads are capped with `http.MaxBytesReader`, and chunked uploads reject declared totals above the same aggregate cap or chunks that exceed the declared total.

Only the 30s `ReadTimeout` constrains total multipart size; per-chunk endpoint is correctly bounded to 2 MiB via `io.LimitReader`. An admin can stream gigabytes to `.volum-tmp/` within the timeout, with two DB writes per chunk loop iteration amplifying load.

**Fix:** Document an expected cap, or apply a configurable aggregate `MaxBytesReader`.

---

### L7. `handleDownload` ReserveDownload increments before the stream completes — ✅ RESOLVED

**File:** `backend/internal/api/handlers_shares.go:160`

**Status:** Resolved. Public downloads still reserve atomically before streaming, but now release the reservation if the stream copy returns an error.

A failed/aborted share download still counts against `MaxDownloads` because `ReserveDownload` increments the counter before `http.ServeFile` streams the bytes.

**Fix:** Decrement on stream failure, or reserve-then-commit after successful send.

---

### L8. SSE streams all jobs/health to every authenticated user including readonly — ✅ ACCEPTED

**File:** `backend/internal/api/handlers_jobs.go:36-100`

**Status:** Accepted for the current single-tenant model. Revisit if Volum introduces per-user isolation.

By-design for the single-tenant model (shared filesystem, no per-user isolation), but a readonly user receives the same job/audit-via-health data as admins. Flag for future multi-user isolation.

**Fix:** If multi-user isolation is ever introduced, scope SSE events per user.

---

## ✅ Verified Clean (no findings)

| Class | Status | Notes |
|---|---|---|
| SQL injection | ✅ | All queries use `?` placeholders; no string concatenation |
| Command injection | ✅ | Only static `lsblk` call; archives use pure-Go `archive/zip`/`tar` |
| `..` traversal / absolute-path escape | ✅ | `cleanPublicInput` + `PathInside` + (Linux) `openat2` |
| Zip Slip / Tar Slip via entry names | ✅ | `cleanExtractEntry`/`cleanArchivePath` reject `../` and absolute paths |
| Zip/tar bombs | ✅ | Per-file/total/entries/depth/space limits in `worker/limits.go` |
| SSRF (health check) | ✅ | Custom dialer re-resolves + re-checks IPs at connect time; blocks private/metadata ranges; nil proxy; 64 KiB body cap |
| Header injection / response splitting | ✅ | `strconv.Quote`/`mime.FormatMediaType` on all filenames |
| Open redirect | ✅ | No `http.Redirect` calls anywhere |
| Deserialization | ✅ | Only trusted/local JSON; HMAC tokens with `hmac.Equal` |
| `InsecureSkipVerify` / weak crypto | ✅ | None; bcrypt + HMAC-SHA256 |
| HMAC session verification | ✅ | Constant-time `hmac.Equal` |
| Share token entropy | ✅ | 256-bit random |
| Public share endpoints | ✅ | Resolve only `share.Path`, refuse directories, outside auth group |

---

## Recommended Priority Order

All findings are resolved or explicitly accepted for the current single-tenant model.
