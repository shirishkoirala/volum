# Contributor Experience Roadmap

## Goal

Make it possible for a first-time contributor to:

1. Understand what Volum does and where a change belongs.
2. Start a safe development environment with one documented command.
3. Make a small change without learning the entire application.
4. Run the same checks locally that CI will run.
5. Submit a pull request with enough context for an efficient review.

The target is not more documentation for its own sake. The target is fewer
places where a contributor must guess.

## Current Baseline

Volum already has several strong foundations:

- Docker development, production, and server compose configurations
- A focused `CONTRIBUTING.md`
- Strict TypeScript, ESLint, Prettier, Vitest, and Testing Library
- Go tests, `golangci-lint`, `go vet`, and `govulncheck`
- CI for frontend and backend checks
- Backend package boundaries for API, auth, files, jobs, security, storage, and
  workers
- Tests that use temporary directories for filesystem and database work
- Environment examples for development and server deployments
- A product roadmap and deployment/release documentation

The main contributor friction found in the repository is:

- No root task runner or single command vocabulary for setup and verification
- No standard pull request template; the only template is for submitting Volum
  to Awesome Selfhosted
- No issue forms, code of conduct, security policy, support policy, or
  ownership file
- Useful smoke and visual scripts are not exposed through a documented command
  surface
- `capture-screenshots.mjs` and `visual-audit.mjs` depend on Puppeteer or
  Playwright without those tools being declared in a root package
- CI commands, Docker build commands, and contributor commands overlap but are
  maintained separately
- Several high-change files are large enough to make first contributions
  difficult:
  - `backend/internal/api/server_test.go` is over 1,300 lines
  - `frontend/src/pages/FilesView.tsx` is over 850 lines
  - `backend/internal/worker/worker.go` is over 750 lines
  - `frontend/src/pages/SettingsPanel.tsx` is over 750 lines
  - `frontend/src/screens/Home.tsx` is over 700 lines
  - `frontend/src/api/client.ts` is nearly 700 lines
- There is no architecture overview showing a request from React through the
  API, `RootGuard`, job store, worker, SQLite, and SSE updates
- Test coverage can be generated, but there is no recorded baseline or policy
- There is no maintained list of small, well-scoped starter tasks

## Principles

### Prefer paved paths

There should be one obvious command for each common action. Contributors should
not need to choose between subtly different Docker, npm, and Go commands.

### Teach through examples

Document one complete frontend change, one API change, and one background job
change. Concrete examples are more useful than long lists of rules.

### Keep safety visible

Volum handles real files. Path validation, conflict behavior, authentication,
cleanup, and test isolation must be part of the normal contribution workflow,
not knowledge held only by maintainers.

### Automate objective review comments

Formatting, linting, generated files, dependency checks, and documentation
links should be checked by tools. Reviewers should focus on behavior,
architecture, security, and usability.

### Refactor along change boundaries

Do not pause product work for a repository-wide rewrite. Split large modules
when a feature or bug fix already touches a coherent area.

## Phase 0: Make the Front Door Obvious

Priority: immediate

Status: in progress

This phase removes uncertainty before a contributor writes code.

### Completed

- Added a standard pull request template for normal Volum changes.
- Added structured bug, feature, and documentation issue forms.
- Added `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `SUPPORT.md`.
- Added `.github/CODEOWNERS` with explicit review ownership.
- Linked contributor and support material from the README.

Repository settings still need to enable private vulnerability reporting and
create the labels referenced by the issue forms.

### Work

- Move the Awesome Selfhosted template into a clearly named specialized
  template or remove it from the repository if it is no longer used.
- Add repository labels such as:
  - `good first issue`
  - `help wanted`
  - `area/frontend`
  - `area/backend`
  - `area/filesystem`
  - `area/auth`
  - `area/docs`
  - `needs reproduction`
  - `blocked`
- Enable GitHub private vulnerability reporting for the repository.

### Junior-friendly details

- Every issue form should explain where to find logs and version information.
- The bug form should warn contributors to reproduce against disposable
  storage.
- Pull request checklists should ask for exact commands, not "tests passed."
- Templates should avoid asking for information maintainers do not use.

### Definition of done

- GitHub automatically suggests the contribution guide when someone opens an
  issue or pull request.
- A new contributor can choose the right issue type without reading the entire
  repository.
- Normal pull requests no longer start from the Awesome Selfhosted template.
- Security reports have a documented private path.

## Phase 1: Create One Command Surface

Priority: immediate

Status: in progress

The repository needs a small task runner at the root. A `Makefile` is the
simplest cross-project option because it can wrap Docker without introducing a
new runtime. A shell-based `scripts/dev` command is a reasonable alternative
if Windows support is explicitly handled.

### Completed

- Added a root `Makefile` with setup, doctor, development lifecycle, checks,
  production build, and smoke-test commands.
- Added a non-destructive environment doctor for Docker, Compose, CPU
  architecture, ports, and writable development directories.
- Added lockfile-aware frontend dependency installation that runs `npm ci` only
  when `package-lock.json` changes or dependencies are missing.
- Updated the Docker dev frontend to use deterministic dependency setup.
- Aligned CI and local full checks on the serialized `test:ci` command.
- Documented the development and server environment examples.
- Made `make clean-dev` preserve bind-mounted `data/` and `storage/`.

### Proposed commands

```text
make help             Show supported commands and prerequisites
make setup            Prepare local directories and print first-run guidance
make dev              Start the Docker development stack
make stop             Stop the development stack
make logs             Follow API and frontend logs
make check            Run all required checks
make check-frontend   Typecheck, format check, lint, test, and build frontend
make check-backend    Lint, vet, test, and build backend
make test-frontend    Run serialized frontend tests
make test-backend     Run backend tests
make smoke            Run the disposable authenticated smoke test
make smoke-proxy      Run the reverse-proxy upload smoke test
make clean-dev        Remove only documented disposable development state
```

### Work

- Make CI call the same underlying scripts used by contributors where
  practical without making CI depend on Docker-in-Docker.
- Verify the command surface on Linux CI in addition to local macOS testing.

### Junior-friendly details

- Command output should state what is happening and what URL to open.
- Failures should include the next corrective action.
- `make help` should distinguish fast checks from full checks.
- The default path must not require Go or Node on the host.

### Definition of done

- A clean clone reaches a working UI using the README plus no more than two
  commands.
- `make check` represents the required pull request checks.
- CI and local commands do not silently use different test modes.
- A contributor can reset development state without risking unrelated files or
  Docker resources.

## Phase 2: Explain the System with Change Maps

Priority: high

Status: completed

The package structure is reasonable, but contributors still need to infer how
the pieces collaborate.

### Completed

- Added `docs/architecture.md` with runtime, startup, authenticated request,
  path safety, file listing, background job, upload, SSE, SQLite, and testing
  flows.
- Added task-oriented guides for a frontend setting, authenticated API
  endpoint, and background job change.
- Added a glossary for project-specific file, job, root, and deployment terms.
- Added a configuration reference covering application and Compose variables.
- Added architecture decision records for path safety, cross-mount moves,
  SQLite concurrency, browser mutation protection, and icon roles.
- Linked the architecture and change guides from contributor entry points.

### Junior-friendly details

- Each change guide should name exact files, tests, and commands.
- Diagrams should show ownership boundaries, not every function.
- Include "common mistake" callouts where failure can lose data or weaken
  security.
- Keep architecture docs close to current code names so repository search works.

### Definition of done

- A contributor can trace an upload or copy operation without reading all of
  `Home.tsx`, `client.ts`, `server.go`, and `worker.go`.
- New API work has a documented checklist covering middleware, client types,
  tests, and errors.
- Important safety decisions are reviewable without relying on oral history.

## Phase 3: Improve Test Ergonomics and Feedback

Priority: high

Status: in progress

The repository has meaningful tests, but contributors need faster targeting
and clearer failure modes.

### Completed

- Added Docker-based targeted Go tests that do not run global lint and tests
  before the selected package.
- Added `FILE` and `NAME` filters for frontend tests.
- Added `PACKAGE` and `NAME` filters for backend tests.
- Added a testing guide with exact full, file, package, and named-test commands.
- Extracted the shared API test server from `server_test.go` into
  `test_helpers_test.go`.
- Fixed asynchronous test cleanup that produced React `act(...)` warnings and
  added a narrow test guard so those warnings fail instead of being ignored.

### Work

- Split `backend/internal/api/server_test.go` by feature:
  - auth and setup
  - files and trash
  - uploads
  - jobs
  - users and profile
  - services and shares
- Add frontend test builders for frequently repeated objects such as file
  entries, jobs, roots, services, and sessions.
- Keep frontend CI tests serialized until parallel execution is proven stable.
- Add coverage reporting to CI as informational first.
- Record an initial coverage baseline by package or subsystem.
- Add thresholds only for critical packages after the baseline is stable:
  security, auth, upload cleanup, conflict handling, and migrations.
- Run `scripts/smoke.sh` in scheduled CI.
- Run the reverse-proxy upload smoke test in scheduled CI or before release.
- Add ShellCheck for shell scripts and a Markdown/link checker for docs.
- Make visual scripts reproducible by declaring Playwright or Puppeteer in a
  dedicated tools package, then expose them through the root task runner.

### Junior-friendly details

- Test helpers should reduce setup, not hide the behavior under test.
- Failure output should identify the request, status, and response body.
- Avoid arbitrary sleeps and broad timeout increases.
- Every bug-fix issue suitable for a junior contributor should identify the
  likely test file.

### Definition of done

- A contributor can run a relevant test in under a minute after dependencies
  are available.
- API tests are grouped by behavior instead of one large file.
- CI distinguishes lint, unit, integration, smoke, and documentation failures.
- Coverage guides missing tests without encouraging low-value assertions.

## Phase 4: Reduce High-Cognitive-Load Modules

Priority: medium

Large files are not automatically bad, but these files combine enough concerns
to slow down review and onboarding. Refactor them only in focused slices with
tests protecting behavior.

### Frontend candidates

- Split `frontend/src/api/client.ts` by domain while preserving a stable public
  import surface:
  - auth and users
  - files and uploads
  - jobs
  - shares
  - desktop services and favorites
- Continue moving command orchestration out of
  `frontend/src/pages/FilesView.tsx` into focused hooks and components.
- Split `frontend/src/pages/SettingsPanel.tsx` by settings category.
- Keep `frontend/src/screens/Home.tsx` responsible for composition, with
  navigation and domain workflows in hooks/providers.
- Add small README files only in directories where ownership is not obvious;
  do not document every folder.

### Backend candidates

- Separate upload validation, resumable-upload state, and HTTP handling in
  `backend/internal/api/handlers_upload.go`.
- Split worker execution by job family while keeping common copy/walk/conflict
  primitives shared.
- Keep route registration centralized in `server.go`, but add route-level tests
  that make middleware requirements explicit.

### Guardrails

- No behavior-changing refactor without tests.
- No generic abstraction until at least two real call sites need it.
- Keep public APIs stable during file moves where possible.
- Prefer one domain extraction per pull request.

### Definition of done

- Common changes touch fewer unrelated sections of large files.
- Reviewers can assign ownership by domain.
- New contributors can understand a target module without loading the entire
  application shell or API client.

## Phase 5: Make Maintenance Predictable

Priority: medium

Contributor friendliness depends on maintainers responding consistently and
keeping automation healthy.

### Work

- Add Dependabot or Renovate for GitHub Actions, npm, Go modules, and Docker
  base images.
- Group routine dependency updates to reduce pull request noise.
- Pin or deliberately version CI actions and document update policy.
- Add a changelog fragment or pull request label convention so contributors do
  not edit the release changelog concurrently.
- Define a lightweight review policy:
  - acknowledge new pull requests
  - identify blocking versus optional feedback
  - close stale requests with a reason
  - explain when a proposal does not fit product scope
- Add release notes that credit external contributors.
- Periodically verify all commands in `CONTRIBUTING.md`.
- Add a scheduled workflow that detects broken docs links and stale generated
  references.

### Definition of done

- Dependency updates are routine and reviewable.
- Contributors know what response to expect after opening a pull request.
- Release notes consistently identify user-facing changes and contributors.
- Documentation commands are tested instead of trusted indefinitely.

## Phase 6: Build a Junior-Friendly Work Queue

Priority: ongoing

Labels alone do not make an issue suitable for a junior developer. Starter
issues need bounded scope and enough context to succeed.

### Good first issue standard

Every `good first issue` should include:

- User-visible problem or maintenance goal
- Exact acceptance criteria
- Likely files or package
- Suggested test location
- Required verification command
- Explicit non-goals
- Screenshots or reproduction steps when relevant
- Maintainer available to answer design questions

### Suggested initial issue themes

- Add Markdown and link checking to CI
- Add a standard pull request template
- Add one-command log and status tasks
- Document running a single frontend and backend test
- Extract one API test feature group from `server_test.go`
- Add frontend object builders for a repeated test fixture
- Add an environment variable reference table
- Make one visual audit script reproducible
- Add accessible names or keyboard tests to an existing component

Do not label broad work such as "split `Home.tsx`," "improve test coverage," or
"make mobile work" as a good first issue. Break it into one behavior with a
clear stopping point.

### Definition of done

- At least five current, unblocked starter issues meet the standard above.
- Each starter issue can be completed without access to production
  infrastructure or maintainer secrets.
- Completed starter issues lead naturally to a slightly larger follow-up.

## Recommended Order

1. Standard PR template, issue forms, `SECURITY.md`, and `CODE_OF_CONDUCT.md`
2. Root task runner with `help`, `dev`, `check`, `test`, and `smoke`
3. Architecture overview and three change guides
4. Targeted-test documentation and API test-file split
5. Reproducible visual/smoke tooling and scheduled checks
6. Domain-based extraction from large files as product work touches them
7. Dependency automation and contributor recognition
8. Maintain a queue of five high-quality starter issues

## Measures of Success

Track a small set of outcomes quarterly:

- Time from clean clone to working development UI
- Percentage of pull requests that pass CI on the first run
- Number of contributor questions caused by undocumented setup
- Median time to first maintainer response
- Number of active `good first issue` items meeting the issue standard
- Number of external contributors who submit a second pull request
- Frequency of flaky test reruns
- Documentation command failures found by scheduled verification

Avoid vanity metrics such as total issue count or raw test count. The useful
signal is whether contributors can complete safe, reviewable changes with less
maintainer intervention.

## Roadmap Completion

This roadmap is complete when the normal contribution path is discoverable,
reproducible, and protected by automation:

- One obvious setup path
- One command vocabulary
- Clear ownership and security reporting
- Change-oriented architecture documentation
- Fast targeted tests and trustworthy full checks
- Small, actionable issues
- Predictable review and release practices

At that point, continue improving contributor experience as part of normal
feature work rather than as a separate cleanup project.
