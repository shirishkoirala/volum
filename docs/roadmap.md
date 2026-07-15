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

## Not Planned For Now

- Full monitoring suite with alert rules, incidents, retention charts
- Native Android/iOS apps
- Plugin marketplace
- Multi-board dashboard layout editor
- Service-specific widget catalog before generic service tiles are mature
