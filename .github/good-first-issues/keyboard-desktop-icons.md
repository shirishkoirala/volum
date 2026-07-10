---
title: Add keyboard navigation to desktop icons
labels: good first issue, area/frontend, accessibility
---

## Problem

Desktop icon items (`DesktopView.tsx` / `useDesktopIcons.tsx`) can be clicked
and dragged but cannot be navigated with arrow keys. A user relying on keyboard
input cannot select or activate desktop icons.

## Acceptance criteria

- Arrow keys (ArrowRight, ArrowLeft, ArrowUp, ArrowDown) move focus between
  desktop icons.
- Enter or Space activates the focused icon (opens the folder, settings, etc.).
- Focus is visually indicated by the existing focus ring (`:focus-visible`).
- The icon grid container has `role="grid"` and each icon has `role="gridcell"`.

## Likely files

- `frontend/src/pages/DesktopView.tsx` — add `onKeyDown` to the icon grid
- `frontend/src/hooks/useDesktopIcons.tsx` — no changes expected
- `frontend/src/pages/DesktopView.module.css` — no changes expected

## Suggested test location

`frontend/src/test/DesktopView.test.tsx`.

## Verification

```sh
make check-frontend
# or locally:
cd frontend && npx tsc --noEmit && npm run test:ci
```

## Non-goals

- Do not add drag-and-drop keyboard support.
- Do not change the layout or visual appearance of icons.

## Follow-up

After this issue, add arrow-key navigation to file grid items
(`FileGridView.tsx`) using the same pattern.
