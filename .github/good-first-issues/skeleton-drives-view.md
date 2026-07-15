---
title: Add loading skeleton to DrivesView
labels: good first issue, area/frontend
---

## Problem

`DrivesView` (`frontend/src/pages/DrivesView.tsx`) shows plain text or nothing
while device data loads. The rest of Volum uses a `Skeleton` component
(`frontend/src/components/ui/Skeleton.tsx`) for loading states — DrivesView
should match this pattern.

## Acceptance criteria

- When devices are loading, DrivesView renders `<Skeleton variant="card" count={4} />`
  instead of raw text.
- The skeleton disappears when loading completes and the device list or empty
  state is shown.
- An error state (if present) still replaces the skeleton.
- The loading state is controlled by a `loading` prop or internal state.

## Likely files

- `frontend/src/pages/DrivesView.tsx` — add skeleton rendering
- `frontend/src/pages/DrivesView.module.css` — styling if needed
- `frontend/src/screens/Home.tsx` — may need to thread a loading prop

## Suggested test location

`frontend/src/test/DrivesView.test.tsx` (create if needed).

## Verification

```sh
make check-frontend
# or locally:
cd frontend && npx tsc --noEmit && npm run test:ci
```

## Non-goals

- Do not redesign the drives layout or empty state.
- Do not add polling or refresh logic to DrivesView.

## Follow-up

After this issue, add a similar skeleton to `SearchResultsView.tsx` loading state.
