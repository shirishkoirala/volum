# Repository Simplification Design

## Goal

Apply the approved Ponytail whole-repository audit as a behavior-preserving
cleanup. Remove code, assets, configuration, and state that Volum does not use,
while retaining every current file-management, storage-analysis, job,
authentication, sharing, and service-health workflow.

## Approach

Use deletion-first refactoring in three isolated areas:

1. Remove repository and delivery artifacts that are stale, duplicated, or
   unused.
2. Remove dormant backend capabilities and collapse one-use wrappers onto the
   existing concrete implementations.
3. Remove dead frontend UI and replace parallel view booleans with the existing
   `ActiveView` model.

No replacement frameworks, compatibility layers, or new abstractions will be
introduced. Existing helpers and standard-library features take precedence.

## Repository and Delivery Cleanup

- Delete the vendored icon-reference catalogue, completed disk-analyzer plan,
  duplicate release guide, obsolete root Compose file, visual-audit script,
  Awesome Selfhosted draft, and local good-first-issue drafts.
- Delete unused `computer.svg` and `go-home.svg` assets.
- Simplify `CODEOWNERS` to the repository-wide owner rule.
- Publish release images only to GitHub Container Registry; remove Docker Hub
  credentials and image output.
- Make the generic build target build the root Dockerfile directly.
- Remove the JetBrains Mono package and use the existing system monospace stack.
- Local issue drafts are deleted without creating remote GitHub issues; remote
  project-management changes are outside this code cleanup.

## Backend Cleanup

- Remove the write-only audit-log store, calls, maintenance endpoint, schema,
  and UI action.
- Remove `DirSizeCache`; directory listing computes immediate sizes directly.
- Remove dormant job scheduling columns, indexes, and claim-query conditions.
  Existing databases may retain the unused SQLite column; no destructive
  migration is required.
- Remove test-only archive-name helpers and redundant legacy filesystem wrapper
  methods, adapting tests to the production APIs.
- Reuse `decodeJSONBody` in handlers with identical request-decoding behavior.
- Reuse the existing SHA-256 helpers instead of duplicate hashing functions.
- Collapse the four uniform worker claim/run branches through one small helper
  while preserving claim priority and the custom trash/archive paths.
- Remove unused configuration output fields and merge duplicate SQL row
  scanners where doing so does not change API behavior.

## Frontend Cleanup

- Delete the `api/client.ts` re-export barrel and import each API from its domain
  module.
- Delete the unused quick-actions component, test-only folder-suggestion
  component, dead styles, unused theme tokens, and unused utility exports.
- Remove the `AppPanel` layout prop because both variants render identically.
- Simplify favorites to the state and actions consumed by `Home`.
- Simplify outside-click handling to one close callback.
- Remove duplicate file-command wiring, dead rename-focus plumbing, and
  pending-upload counters that never produce a nonzero value.
- Replace six mutually exclusive view booleans with one `ActiveView` state;
  drive selection and search query remain their own data.
- Preserve current desktop, files, drives, trash, settings, jobs, search, and
  storage-analyzer navigation behavior.

## Error and Data Safety

- Keep all `RootGuard` validation, authentication checks, conflict handling,
  transactional job maintenance, and cross-mount copy/verify/delete behavior.
- Do not alter API request validation where an existing handler intentionally
  has different size limits or error responses.
- Do not migrate or delete user data. SQLite cleanup is forward-only: new
  databases omit dormant structures and old databases continue to work.
- Do not create remote issues, publish images, deploy releases, or modify other
  external systems.

## Verification

- Update or delete tests only when their sole subject is removed test-only code.
- Add or retain focused coverage for navigation and request decoding where
  behavior is refactored.
- Run frontend type-check, lint, tests, and production build through Docker.
- Run backend formatting, vet, and tests through Docker.
- Build the production server image and perform a browser smoke test of the
  main views and storage analyzer.

## Success Criteria

- All audited dead code and repository bloat in this design is removed.
- No new runtime dependency or abstraction is introduced.
- Docker verification is green.
- Existing user-visible workflows behave the same after the cleanup.
