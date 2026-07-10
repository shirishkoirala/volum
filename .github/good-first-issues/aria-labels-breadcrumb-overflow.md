---
title: Add accessible labels to BreadcrumbNav overflow button
labels: good first issue, area/frontend, accessibility
---

## Problem

The `BreadcrumbNav` component (`frontend/src/components/layout/BreadcrumbNav.tsx`)
shows `···` (three dots) when crumbs overflow the available width. This button
has no `aria-label` or `title` attribute, so screen reader users cannot tell what
it does.

## Acceptance criteria

- The overflow trigger button (`styles.overflowBtn`) has `aria-label="Show more breadcrumbs"`.
- The overflow menu (`styles.overflowMenu`) has `role="menu"` and each item has `role="menuitem"`.
- A test in `frontend/src/test/` verifies the label is present when overflow is active.

## Likely files

- `frontend/src/components/layout/BreadcrumbNav.tsx` — add `aria-label` and `title`
- `frontend/src/components/layout/BreadcrumbBar.module.css` — no changes expected
- `frontend/src/test/BreadcrumbBar.test.tsx` or new `BreadcrumbNav.test.tsx`

## Suggested test location

`frontend/src/test/BreadcrumbBar.test.tsx` (or create `BreadcrumbNav.test.tsx`).

## Verification

```sh
make check-frontend
# or locally:
cd frontend && npx tsc --noEmit && npm run test:ci
```

## Non-goals

- Do not change the overflow calculation logic or CSS.
- Do not add interactive behavior such as keyboard focus management.

## Follow-up

After this issue, `aria-label` and keyboard navigation can be added to the
toolbar overflow menu (`styles.moreBtn` in `BreadcrumbBar.tsx`).
