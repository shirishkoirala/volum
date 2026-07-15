---
title: Add aria-labels to SettingsPanel category filter buttons
labels: good first issue, area/frontend, accessibility
---

## Problem

`SettingsPanel.tsx` (`frontend/src/pages/SettingsPanel.tsx`) renders category
filter buttons at the top of the settings page. Each button shows an icon and
the active category has a visual underline, but there is no accessible label.
Screen reader users hear an unlabeled button.

## Acceptance criteria

- Each settings category button has `aria-label` matching the category name
  (e.g., `"General"`, `"Server"`, `"Storage"`, `"Desktop"`, `"Admin"`,
  `"About"`).
- The active category button has `aria-current="page"`.
- A test verifies the labels and `aria-current` attribute.

## Likely files

- `frontend/src/pages/SettingsPanel.tsx` — add `aria-label` and `aria-current`

## Suggested test location

`frontend/src/test/SettingsPanel.test.tsx`.

## Verification

```sh
make check-frontend
# or locally:
cd frontend && npx tsc --noEmit && npm run test:ci
```

## Non-goals

- Do not change the visual design, layout, or filtering behavior.
- Do not add keyboard navigation to the category row.

## Follow-up

After this issue, add `aria-label` to the Dock component's icon buttons
(`frontend/src/components/layout/Dock.tsx`).
