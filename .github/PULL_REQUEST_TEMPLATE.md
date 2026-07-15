## What changed

<!-- Describe the behavior changed by this pull request. -->

## Why

<!-- Explain the user problem, bug, or maintenance need. Link the issue. -->

Closes #

## How it works

<!-- Note important implementation decisions, tradeoffs, and alternatives. -->

## Verification

<!-- List the exact commands and manual workflows you ran. -->

- [ ] Frontend typecheck, formatting, and lint
- [ ] Relevant frontend tests
- [ ] Relevant backend checks
- [ ] Production build, when applicable
- [ ] Manual workflow tested with disposable storage

Commands:

```text

```

## User interface

<!-- Add before/after screenshots or a short recording for visible changes. -->

Not applicable.

## Risk and rollout

<!-- Cover data safety, auth, migrations, deployment, and compatibility. -->

- Data or migration impact: None
- Security impact: None
- Configuration changes: None
- Rollback approach: Revert this pull request

## Scope

<!-- State intentional non-goals or follow-up work. -->

## Reviewer checklist

- [ ] Filesystem paths still pass through `RootGuard`
- [ ] Protected API routes retain appropriate auth, role, and request checks
- [ ] Existing files are not overwritten without an explicit conflict policy
- [ ] Failures and cancellations clean up partial state
- [ ] Tests cover the changed behavior and important failure paths
- [ ] Documentation matches user-visible or configuration changes
