# Volum Roadmap

Guiding principles: KISS, YAGNI, SOLID.

## Priority 1: Large Folder Performance

Status: ongoing. Server-side pagination and progressive loading are done. Remaining work:

- Add list virtualization for large file grids/lists
- Keep preview/thumbnail generation cancelable when navigation changes

## Priority 2: Preview Window Polish

Status: ongoing. Preview navigation, actions, and cleanup are done. Remaining:

- Preserve file list scroll position after closing preview

## Priority 3: Mobile And Responsive Desktop

Status: not started.

- Audit desktop, files, settings, jobs, preview, and service forms at mobile widths
- Make desktop icon layout predictable on narrow screens
- Keep touch actions first-class: long-press context menu, drag safety, readable controls

## Priority 4: Service Health And Notifications

Status: partially done (health polling exists, visibility-aware).

- Add backend-owned health monitoring with down/up transition events
- Add per-service health interval and notification toggle
- Browser notification support for health transitions
- Webhook/email channels deferred until needed

## Priority 5: Service Widgets And Integrations

Status: not started.

- Start with simple service metadata: health, open mode, icon, URL, description
- Prefer generic widgets before service-specific integrations
- Avoid becoming a full Homarr/Homepage replacement

## Engineering Track: Shared UI Consolidation

Status: completed on 2026-07-30. Outcome: roughly 400 net lines removed, including new
focused coverage, without adding prop-heavy universal components.

### Batch 1: Reuse Existing Primitives — Complete

- [x] Render `SearchResultsView` and every `TrashView` state through `AppPanel`
- [x] Use `GridTile` for the grid branch of `FileItem`; keep its list branch local
- [x] Replace Storage Analyzer's custom action buttons and error banners with `Button` and
  `ErrorBanner`
- [x] Replace raw selects in service and user administration forms with `Select`
- [x] Use `useLocalStorage` for desktop icon ordering
- [x] Centralize `isAnalysisJob` and use the existing `job-${job.type}` icon mapping
- [x] Remove the duplicate About version/build/runtime content already shown by `ServerInfo`

### Batch 2: Add Small Shared Components — Complete

- [x] Add `ContextMenuItem` for icon, role, disabled/danger state, action, and close behavior
- [x] Merge the identical Jobs and Trash refresh context menus
- [x] Add `SearchSuggestions` for the duplicated top-bar and file-toolbar result dropdowns
- [x] Extend `Button` with `busy` and `busyLabel`; busy implies disabled, spinner, and
  `aria-busy`
- [x] Add settings-local `SettingsSection` for the repeated section and heading wrapper
- [x] Add `InlineFeedback` for consistent compact success/error text and live-region roles

### Batch 3: Consolidate Shared Styles — Complete

- [x] Move common grid/list interaction styles into `FileEntriesView.module.css`
- [x] Let `ProgressBar` own drive and partition meter styling; add a compact size only if needed
- [x] Share the repeated dropdown footer-action style without adding another wrapper component
- [x] Delete unchanged dark-theme token redeclarations and use `--font-mono` in Storage Analyzer

### Re-evaluation — Complete

- [x] Do not add `StorageUsageCard`; after `ProgressBar` consolidation, the remaining drive,
  partition, and root markup has different behavior and metadata
- [x] Keep Analyzer summaries and toolbars local; extracting them would move markup without
  reducing state or maintenance complexity

### Guardrails

- Require at least two current consumers and a measurable net deletion before extracting
- Keep feature-specific state, permissions, keyboard behavior, and navigation local
- Do not build a universal file row/tile, job card, async-content wrapper, form field, or menu
  system
- Preserve existing accessibility behavior and add focused regression coverage for each
  shared interaction

## Not Planned For Now

- Full monitoring suite with alert rules, incidents, retention charts
- Native Android/iOS apps
- Plugin marketplace
- Multi-board dashboard layout editor
- Service-specific widget catalog before generic service tiles are mature
