# Testing Guide

Use the smallest relevant test while iterating, then run the full checks before
requesting review.

## Frontend

Run all frontend tests in the serialized CI mode:

```sh
make test-frontend
```

Run one test file:

```sh
make test-frontend FILE=src/test/Dialogs.test.tsx
```

Run tests whose names match a pattern:

```sh
make test-frontend NAME="shows error when submitting empty value"
```

Combine both filters:

```sh
make test-frontend \
  FILE=src/test/Dialogs.test.tsx \
  NAME="shows error when submitting empty value"
```

Frontend tests live in `frontend/src/test/` and use Vitest, jsdom, Testing
Library, and `userEvent`.

Guidelines:

- Test observable behavior rather than component internals.
- Prefer queries by role, label, or accessible name.
- Await `userEvent` calls.
- Use `waitFor` for asynchronous state that the user can observe.
- Do not add sleeps or increase global timeouts to hide a race.
- Treat React `act(...)` warnings as test defects even when the test passes.

Run the complete frontend quality gate with:

```sh
make check-frontend
```

## Backend

Run all Go tests:

```sh
make test-backend
```

Run one package:

```sh
make test-backend PACKAGE=./internal/api
```

Run one named test:

```sh
make test-backend \
  PACKAGE=./internal/api \
  NAME=TestUploadChunkResumesAndFinalizesSpecialCharacterFilename
```

`docker-compose.test.yml` builds the Go toolchain and dependencies, then mounts
the current `backend/` source. The first run can take longer; later runs reuse
the Docker build and Go build caches. It does not start Volum or mount project
storage.

Remove the isolated test network and cache when needed:

```sh
make clean-test
```

Backend test guidelines:

- Use `t.TempDir()` for files and SQLite databases.
- Use `httptest` for API behavior.
- Test authorization and invalid input, not only successful requests.
- Include outside-root and symlink-escape cases for path-sensitive work.
- Verify cleanup after cancellation and failure.
- Use table-driven tests when cases share setup and assertions.

Run backend lint, vet, and the complete test suite with:

```sh
make check-backend
```

## Full and End-to-End Checks

Before requesting review:

```sh
make check
```

For deployment, auth, upload, or proxy changes, also run the relevant
disposable smoke test:

```sh
make smoke
make smoke-proxy
```

Smoke tests create temporary data and remove their containers and files on
exit. They must never point at real user storage.

## Test Failure Triage

1. Re-run the smallest failing file, package, or named test.
2. Read the first failure rather than later cascading failures.
3. Confirm whether the failure is deterministic.
4. Check for leaked timers, event listeners, containers, files, or database
   handles.
5. Fix the test only when the expected behavior is still correct.
6. Add the exact reproduction command to the pull request.
