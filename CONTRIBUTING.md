# Contributing to Volum

Volum is a self-hosted file manager that operates on real server storage. A
good contribution is focused, tested, and conservative about files,
permissions, authentication, and existing data.

## Before You Start

- Check the [roadmap](docs/roadmap.md) for current priorities.
- Check the
  [contributor experience roadmap](docs/contributor-experience-roadmap.md) for
  planned repository and onboarding improvements.
- Search existing issues and pull requests before starting overlapping work.
- For a large feature, security-sensitive change, schema change, or new
  dependency, open an issue first and describe the use case and proposed
  approach.
- Keep pull requests small enough to review. Separate cleanup from behavioral
  changes unless the cleanup is required by the change.

Good first contributions include focused bug fixes, missing tests, accessible
labels or keyboard behavior, documentation corrections, and small roadmap
items with a clear acceptance condition.

## Prerequisites

- Git
- Docker with Docker Compose v2
- Node.js 22 and npm are optional for faster frontend-only checks
- Go 1.23 is optional; the supported backend verification path uses Docker

## Set Up the Development Environment

1. Fork and clone the repository.
2. Create a branch from `master`.
3. Prepare the development environment:

```sh
make setup
```

4. Start the Docker development stack:

```sh
make dev
```

Open `http://localhost:8342`. The API is also exposed at
`http://localhost:8090`.

The dev stack mounts:

- `./frontend` into the Vite container for live reload
- `./storage` as the browsable test root
- `./data` for the local SQLite database

Use disposable files under `storage/` when testing file operations. Never point
a development instance at storage you cannot afford to modify.

Authentication is enabled by default in the dev stack. Follow the first-run
setup screen in the browser. Local state can be reset by stopping the stack and
removing the development database yourself; do not include it in a commit.

Run `make help` for the supported command list. The default workflow requires
Docker and Make, but does not require Node.js or Go on the host.

### Environment files

The Docker development stack has safe defaults and does not require an `.env`
file for the first run.

- Copy `.env.development.example` to `.env` only when you need to override
  development paths or authentication behavior.
- Use `.env.server.example` as the starting point for a server deployment. It
  enables authentication and documents host-mount settings.
- Never commit `.env`; it may contain secrets and machine-specific paths.

See the [configuration reference](docs/configuration.md) for defaults,
validation rules, root mapping, and the distinction between application and
Compose-only variables.

## Repository Map

```text
backend/
  cmd/volum/             Application entry point
  internal/api/          Routes, handlers, and HTTP middleware
  internal/auth/         Users, sessions, roles, and signed cookies
  internal/config/       Environment configuration and mount discovery
  internal/desktop/      Favorites, services, and service health
  internal/files/        File listing, trash, disk usage, and caches
  internal/jobs/         SQLite-backed asynchronous job store
  internal/security/     Allowed-root path validation
  internal/shares/       Share link persistence
  internal/storage/      SQLite setup and schema migrations
  internal/worker/       Copy, move, archive, extract, and checksum workers

frontend/src/
  api/                   Typed HTTP client and icon helpers
  components/            Reusable input, layout, overlay, and UI components
  contexts/              Shell and window management state
  hooks/                 Stateful reusable React behavior
  pages/                 Workspace page views
  screens/               Full application screens
  styles/                Global styles and design tokens
  test/                  Vitest and Testing Library tests
  types/                 Shared TypeScript types
  utils/                 Pure shared utilities

.github/workflows/       CI and release automation
docs/                    Roadmap, deployment, release, and audit documents
```

Read the [architecture overview](docs/architecture.md) before changing a
cross-cutting workflow. The [change guides](docs/change-guides/README.md)
provide focused checklists for frontend settings, API endpoints, and background
jobs. The [glossary](docs/glossary.md) defines project terms, and
[architecture decision records](docs/adr/README.md) explain constraints that
must survive refactoring.

## Common Change Paths

### Frontend change

1. Put reusable stateful behavior in `hooks/` and pure logic in `utils/`.
2. Use a colocated `*.module.css` file for component styles.
3. Add or update a test in `frontend/src/test/`.
4. Run type checking, formatting, linting, tests, and the production build.
5. Exercise the workflow in the Docker dev server at desktop and narrow widths
   when layout or interaction changes.

### API change

1. Register the route in `backend/internal/api/server.go`.
2. Implement it in the matching `handlers_*.go` file.
3. Apply `requireUser`, `requireAdmin`, and `requireAPIRequest` consistently
   with routes of the same sensitivity.
4. Add backend coverage in the owning package or
   `backend/internal/api/server_test.go`.
5. Add the typed client request and response definitions in
   `frontend/src/api/client.ts`.
6. Test authorization failures as well as the successful path.

### File operation or job change

1. Resolve every user-supplied path through `RootGuard`.
2. Define new job types and statuses in `backend/internal/jobs/model.go`.
3. Add claiming and persistence behavior in the appropriate `store_*.go` file.
4. Implement worker behavior in `backend/internal/worker/`.
5. Cover interruption, conflicts, partial failure, and cleanup in tests.
6. Verify that audit and user-visible job state remain accurate.

### Database change

Keep migrations backward compatible and idempotent. Add migration coverage in
`backend/internal/storage/`, and verify both a new database and an existing
database upgraded in place. Do not rewrite or delete user data implicitly.

## Code Conventions

### Backend

- Format Go with `gofmt` and `goimports`.
- Return errors with useful context and preserve errors that callers inspect.
- Pass request contexts through database and network operations.
- Close rows, response bodies, and files on every path.
- Keep handlers thin; filesystem, job, and persistence logic belongs in the
  owning package.
- Never bypass `RootGuard`.
- Never overwrite an existing destination silently.
- A cross-mount move is copy, verify, then delete, not a direct rename.
- Bound concurrency, request sizes, and external health-check timeouts.

### Frontend

- Use strict TypeScript and avoid weakening types to get a change through.
- Use CSS Modules with camelCase references such as `styles.dialogBody`.
- Reuse values from `styles/tokens.css`; avoid one-off colors and dimensions.
- Put shared path, formatting, archive, job, preview, and view logic in
  `frontend/src/utils/`.
- Use asset SVGs through the icon helpers for desktop, drive, folder, and file
  type icons.
- Use Lucide icons for actions such as copy, refresh, edit, and close.
- Keep workspace pages in `pages/` and transient dialogs in
  `components/overlay/`.
- Preserve keyboard, focus, loading, empty, error, and disabled states.

## Tests and Checks

Run checks through Docker when possible. The supported full check is:

```sh
make check
```

Focused command groups are available when iterating:

```sh
make check-frontend
make check-backend
make test-frontend
make test-backend
```

Build the production image before a release or when Docker packaging changes:

```sh
make build
```

Run disposable end-to-end checks for relevant deployment changes:

```sh
make smoke
make smoke-proxy
```

Local frontend commands are acceptable when Docker is unavailable:

```sh
cd frontend
npm ci
npm run typecheck
npm run format:check
npm run lint
npm run test:ci
npm run build
```

CI also runs `npm audit`, `golangci-lint`, `go vet`, `go test`, and
`govulncheck`. A pull request is not ready to merge while a required check is
failing.

### Test expectations

- Add a regression test for every bug fix when practical.
- Prefer behavior visible to a user over component implementation details.
- Use Testing Library queries by role, label, or accessible name.
- Await `userEvent` interactions and state updates; do not hide race conditions
  by adding arbitrary sleeps or excessive timeouts.
- Use temporary directories for filesystem tests.
- Cover permission denial and invalid-path cases for sensitive handlers.

## Security and Data Safety

Treat these as review blockers:

- Path traversal or raw filesystem access outside `RootGuard`
- Authentication or role checks removed from a protected route
- Host, origin, cookie, or proxy validation weakened without a documented need
- Secrets, tokens, `.env` files, databases, uploaded files, or personal paths
  committed to the repository
- Existing files overwritten without an explicit conflict policy
- Partial uploads or failed jobs leaving untracked temporary files

Report vulnerabilities privately to the maintainers instead of opening a
public issue with exploit details.

Do not commit generated or runtime content:

- `.env`
- `data/`
- `storage/`
- `backend/web/`
- `frontend/dist/`
- `frontend/node_modules/`
- coverage output

## Pull Requests

Use an imperative commit subject, for example:

```text
fix: clean up partial upload after cancellation
feat: add conflict resolution for archive extraction
docs: clarify reverse proxy host configuration
```

A pull request should include:

- The problem and why it matters
- The chosen approach and important tradeoffs
- Tests run, with exact commands
- Screenshots or a short recording for visible UI changes
- Deployment, migration, security, or compatibility notes
- Follow-up work intentionally left out of scope

Before requesting review:

- Rebase or merge the latest `master` as appropriate.
- Review the final diff for unrelated changes and secrets.
- Update documentation when behavior or configuration changes.
- Update screenshots when documented UI changes materially.
- Confirm all relevant checks pass.

Draft pull requests are appropriate for early design feedback. Mark the pull
request ready only when the implementation and verification are complete.

## Documentation Scope

Keep `README.md` focused on the product and first run. Put contributor workflow
and code conventions here. Put deployment details in `docs/reverse-proxy.md`,
release operations in `docs/release.md`, and planned product work in
`docs/roadmap.md`. Track onboarding and repository-maintenance improvements in
`docs/contributor-experience-roadmap.md`. Keep runtime boundaries and common
change paths in `docs/architecture.md` and `docs/change-guides/`.
