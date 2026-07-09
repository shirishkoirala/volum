# ADR 0005: Desktop Assets and Action Icons Have Separate Roles

Status: accepted

## Context

Volum combines a desktop metaphor with conventional application controls.
Using one icon source for both made file types less recognizable or action
controls inconsistent.

## Decision

- Desktop objects, drives, folders, and file types use bundled SVG assets
  exposed through `frontend/src/api/icons.ts`.
- Toolbar, menu, dialog, and command actions use Lucide through the shared
  `Icon` component.

## Consequences

- New file types extend the asset mapping rather than the Lucide action map.
- New actions reuse an existing Lucide icon when possible.
- Decorative icon implementations should not introduce hand-authored inline
  SVG when either established source already covers the need.
