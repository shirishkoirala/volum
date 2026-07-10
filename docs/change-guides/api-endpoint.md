# Add an Authenticated API Endpoint

Use this checklist for a new JSON endpoint under `/api`.

## 1. Choose the domain owner

The handler parses HTTP input and writes HTTP output. Put business logic in the
owning package:

- Filesystem listing/trash/search: `backend/internal/files/`
- Job state: `backend/internal/jobs/`
- Long-running filesystem work: `backend/internal/worker/`
- Users and sessions: `backend/internal/auth/`
- Shares: `backend/internal/shares/`
- Desktop favorites/services: `backend/internal/desktop/`

## 2. Register the route

Add the route in `backend/internal/api/server.go`.

Choose middleware deliberately:

- `requireUser` for authenticated reads
- `requireAPIRequest` for browser request and origin protection
- `requireAdmin` for filesystem mutations, user administration, database
  maintenance, and other privileged operations

Follow a neighboring route with equivalent sensitivity. Do not put a mutation
in the read-only route group.

## 3. Implement the handler

Use the matching `handlers_*.go` file.

- Parse query values explicitly.
- Use `decodeJSONBody()` for JSON request bodies.
- Validate limits and enum values.
- Resolve user-supplied paths with `RootGuard`.
- Pass `r.Context()` to stores and network operations.
- Use `writeError()` for known domain errors.
- Return a stable JSON shape with an explicit status.

Do not expose internal filesystem paths or raw database errors.

## 4. Add backend tests

Add tests in the owning package or API tests. Cover:

- Successful request
- Unauthenticated request
- Readonly user when admin is required
- Missing CSRF request header for a mutation
- Invalid JSON or parameters
- Path outside roots, when applicable
- Missing record and domain conflict

Use `t.TempDir()` and `httptest`; never use a developer's real files.

## 5. Add the frontend client

Define request/response types and a function in the appropriate
`frontend/src/api/client-*.ts` domain file, then re-export through
`frontend/src/api/client.ts` (the barrel). Use the shared `request<T>()`
helper for JSON calls. Direct `fetch` calls must preserve `apiUrl()`, error
parsing, and the `X-Volum-Request` header for unsafe methods.

Keep transport details out of components.

## 6. Add frontend behavior and tests

Call the typed client from a hook, page, or focused component. Represent:

- Initial state
- Loading state
- Success state
- Empty state where relevant
- Error and retry behavior
- Permission-dependent controls

Mock the client boundary in focused UI tests.

## 7. Verify

```sh
make check
make dev
```

Inspect the browser network request and test the endpoint as both admin and
readonly users when roles matter.

## Pull request notes

Document the route, authorization policy, input limits, response shape, and any
filesystem or migration impact.
