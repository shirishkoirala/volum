# ADR 0004: Browser Mutations Require Request Validation

Status: accepted

## Context

Session cookies authenticate browser requests. Without an additional signal
and origin validation, another site could attempt state-changing requests
against a logged-in Volum instance.

## Decision

Unsafe `/api` methods require:

- An authenticated user
- The `X-Volum-Request: fetch` header
- A same-host `Origin` when the browser supplies one
- The admin role for privileged mutations

Reverse proxies and the Vite development proxy must preserve a valid request
origin rather than disabling these checks.

## Consequences

- Frontend direct `fetch` calls must set the request header.
- Proxy configuration is part of mutation correctness.
- Tests should cover missing headers, disallowed origins, and role denial.
- Public unlock/download routes use their own deliberately scoped policy.
