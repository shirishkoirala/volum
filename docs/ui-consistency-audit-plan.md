# UI Consistency Audit Fix Plan

## Summary

Static UI inspection found several concrete inconsistencies and a few visual bugs introduced or exposed by the recent component reorganization. This plan is limited to frontend UI consistency; it does not require backend or API changes.

## Key Changes

- Fix missing theme tokens used by UI styles:
  - `--color-accent` is referenced by Jobs, Settings, and Share Manager styles but is not defined in `tokens.css`.
  - `--shadow-lg` is referenced by dialog styles but is not defined.
  - `--color-brand-subtle` is referenced by transfer preview fate badges but is not defined.
- Fix unstyled Batch Rename actions:
  - `BatchRenameModal.tsx` uses global `dialog-button secondary` and `dialog-button primary` class names, but the dialog button styles live in `Dialogs.module.css`.
  - Replace those class names with module class references or introduce a shared button primitive.
- Normalize panel header styling:
  - `PanelHeader` in `components/ui/shared.tsx` emits global `panel-header` classes.
  - Equivalent panel header styles exist in both `shared.module.css` and `global.css`.
  - Prefer one pattern: make `PanelHeader` use CSS-module classes and migrate overlays to it.
- Remove inline styling that breaks the CSS Modules convention:
  - Settings root warning badge and share spacing use inline styles in `SettingsPanel.tsx`.
  - Share Manager skeleton cell widths use inline styles in `ShareManager.tsx`.
  - Replace these with semantic CSS-module classes.
- Fix settings category icon fallbacks:
  - Settings uses `drive-harddisk` and `help-about`, but `Icon.tsx` does not map those names, so they fall back to the square icon.
  - Add explicit icon mappings or switch those categories to supported action icon names.
  - Keep desktop Settings as an asset SVG, matching the existing desktop icon convention.

## Test Plan

- Run `cd frontend && npx tsc --noEmit`.
- Run `cd frontend && npm run build`.
- Manually inspect Desktop, Files, Trash, Jobs, Settings page, Share dialog, Share manager, Batch rename modal, and Info panel.
- Verify light and dark themes for active tabs, retry links, dialog shadows, fate badges, and close/header styles.

## Assumptions

- No public API or backend behavior changes are needed.
- Keep the existing CSS Modules architecture.
- Prefer token fixes in `tokens.css` only when the token represents a reusable theme concept. Otherwise, replace references with existing tokens such as `--color-brand`, `--shadow-menu`, or `--color-brand-bg`.
