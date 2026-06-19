# Top Bar Plan

This document proposes how to evolve Volum's top bar into a more useful global shell surface without turning it into a second toolbar, second status bar, or second workspace.

The current top bar lives in `frontend/src/components/layout/TopBar.tsx`.

Today it contains:

- brand / desktop button
- contextual app menu for files and trash
- date and time
- user menu

That is a good minimal base. The next step is to add only items that are truly global or clearly tied to the currently focused window.

## Goal

Make the top bar more useful for everyday work while keeping it quiet and predictable.

The top bar should answer three needs:

- global navigation and search
- global status and alerts
- focused-window quick actions

It should not become the place for detailed file metadata, layout-heavy tools, or view-specific clutter.

## Design Rule

Use this split consistently:

- top bar: global navigation, global status, focused-window shortcuts
- status bar: counts, path, storage, selection size
- window content: detailed tools and view-specific controls

If a control needs a lot of space or only matters inside one page, it does not belong in the top bar.

## Recommended Additions

## 1. Global Search

This is the highest-value addition.

Why it fits:

- search is useful across views
- the app already has search state and a dedicated search results view
- the top bar is the natural place for cross-workspace search

What it should do:

- place a search input in the center area of the top bar
- open the existing search results flow
- use the current quick search behavior while typing
- submit into the full search results view

What it should not do:

- create a second independent search implementation
- replace local in-view filtering where that is a different behavior

Implementation direction:

- lift a compact `TopBarSearch` component into the top bar
- connect it to `useNavigation` search state
- reuse existing search actions and the `search` active view

Likely files:

- `frontend/src/components/layout/TopBar.tsx`
- `frontend/src/components/layout/TopBar.module.css`
- `frontend/src/hooks/useNavigation.ts`
- search-related components already used by files/search views

## 2. Activity / Notifications Button

This is the second-best addition because jobs and health events are global.

Why it fits:

- transfer activity is not tied to one window
- service health transitions are already global
- users need one place to see recent activity without switching views

What it should show:

- active transfers count
- recent failed jobs
- recent completed jobs
- recent service health transitions

Recommended UI:

- one bell or activity icon in the right-side action cluster
- small badge for unread/new items
- clicking opens a compact dropdown or side panel

Initial scope:

- read-only panel
- no complex filtering
- no full timeline yet

Implementation direction:

- feed from `useJobs`
- optionally include service health transitions already surfaced via SSE
- keep the panel compact and secondary to the Jobs page

Likely files:

- `frontend/src/components/layout/TopBar.tsx`
- new `frontend/src/components/layout/ActivityPanel.tsx`
- new `ActivityPanel.module.css`
- `frontend/src/hooks/useJobs.ts`

## 3. Theme Toggle

This is a low-cost, high-fit global control.

Why it fits:

- theme is global
- it already exists in app state
- it is a common shell-level toggle

Recommended UI:

- icon button in the right-side action cluster
- sun/moon icon via the existing `ThemeToggle` component

Implementation direction:

- reuse `frontend/src/components/ui/ThemeToggle.tsx`
- pass `theme` and `onToggleTheme` from `Home` through to `TopBar`

Likely files:

- `frontend/src/components/layout/TopBar.tsx`
- `frontend/src/screens/Home.tsx`

## 4. Focused-Window Quick Actions

These are useful, but only if they respect the currently focused window.

Why they fit:

- users often need one-click access to common actions
- the app already has a focused window + command registration model

Good candidate actions:

- refresh
- upload
- new folder
- paste

Rules:

- only enable actions when the focused window supports them
- do not dispatch blindly to the wrong context
- keep this group small

Recommended UI:

- a compact icon group near the center-right area
- only shown for file-oriented windows
- disabled state when the command is unavailable

Implementation direction:

- reuse the `commandsMap` and `focusedCommands` pattern already present in `Home.tsx`
- add a `TopBarQuickActions` component

Likely files:

- `frontend/src/components/layout/TopBar.tsx`
- new `frontend/src/components/layout/TopBarQuickActions.tsx`
- `frontend/src/screens/Home.tsx`

## 5. Connection / Sync State Indicator

This should be subtle, not noisy.

Why it fits:

- backend/API connectivity is global
- SSE disconnects and reconnects affect the whole workspace
- users need a visible signal when the shell is degraded

What it should show:

- connected
- reconnecting
- offline / API unavailable

Recommended UI:

- a small dot or link-status icon
- tooltip text for exact state
- no large banner unless the failure is persistent

Implementation direction:

- derive from SSE / API connection health
- keep the indicator passive unless there is a problem

Likely files:

- `frontend/src/components/layout/TopBar.tsx`
- `frontend/src/hooks/useJobs.ts` or a new shell connectivity hook

## 6. Optional Focused Selection Badge

This is optional and should stay minimal.

Why it may fit:

- selection count is useful when working quickly
- users sometimes need instant confirmation that actions target the right items

Safe version:

- show a small badge like `3 selected`
- only when a file/trash window is focused

Unsafe version:

- repeating counts, bytes, and path details already present in the status bar

Recommendation:

- add only if it stays to one short badge

## What Should Not Go In The Top Bar

Do not add:

- free disk space
- current path
- detailed item counts
- large view-mode controls
- wallpaper controls
- service management controls
- full transfer tables
- settings categories
- large breadcrumb bars

These either already belong somewhere else or would make the bar noisy.

## Proposed Layout

Use a three-zone layout.

## Left Zone

- brand / go-desktop
- contextual app menu
- focused-window quick actions

This keeps application identity and high-frequency actions together.

## Center Zone

- global search

The center should belong to search because it is the broadest, most universally useful control.

## Right Zone

- connection indicator
- activity / notifications button
- theme toggle
- date/time
- user menu

This keeps passive status and account controls grouped together.

## Visual Density Rules

- use icon buttons for compact shell actions
- keep labels only where recognition would otherwise be weak
- preserve the current low-height top bar
- avoid multi-row behavior
- collapse lower-priority controls on mobile

## Suggested Component Structure

Suggested additions under `frontend/src/components/layout/`:

```text
frontend/src/components/layout/
├── TopBar.tsx
├── TopBar.module.css
├── TopBarSearch.tsx
├── TopBarSearch.module.css
├── TopBarQuickActions.tsx
├── TopBarQuickActions.module.css
├── ActivityPanel.tsx
└── ActivityPanel.module.css
```

This keeps the top bar from becoming another oversized all-in-one component.

## Data Sources To Reuse

These features should be built on top of existing state, not invented from scratch.

## Search

Reuse:

- `useNavigation` search query state
- existing search results behavior
- current search result view

## Activity

Reuse:

- `useJobs`
- job SSE events
- service health transitions already emitted through SSE

## Quick Actions

Reuse:

- `commandsMap`
- `focusedCommands`
- focused window tracking already done in `Home.tsx`

## Theme

Reuse:

- `theme`
- `onToggleTheme`
- existing `ThemeToggle`

## Connectivity

Reuse if possible:

- existing SSE connection lifecycle in `useJobs`
- current API request error handling

## Implementation Phases

## Phase 1: Structural Refactor

Goal: prepare `TopBar` for growth without changing much behavior.

Work:

- split `TopBar` into left / center / right layout groups
- extract `TopBarSearch` placeholder
- extract `TopBarQuickActions` placeholder
- add prop plumbing for theme and optional activity state

Result:

- better structure
- no major visual change yet

## Phase 2: Add Global Search

Goal: make search the main center control.

Work:

- add active search input to top bar
- wire to existing search state and results view
- preserve current search behavior

Result:

- top bar becomes meaningfully more useful

## Phase 3: Add Theme Toggle And Connection Indicator

Goal: add two small global shell controls with low implementation risk.

Work:

- add theme toggle
- add passive connection status indicator

Result:

- more complete shell with minimal visual cost

## Phase 4: Add Activity Panel

Goal: expose cross-workspace activity without forcing a view switch.

Work:

- add activity icon with badge
- add compact dropdown/panel
- show jobs and recent health transitions

Result:

- better visibility into background work

## Phase 5: Add Focused-Window Quick Actions

Goal: improve speed for common operations.

Work:

- add refresh/upload/new-folder/paste where supported
- disable or hide based on focused window command availability

Result:

- top bar becomes more efficient for active work

## Mobile / Narrow Width Behavior

Do not try to keep everything visible on narrow screens.

Recommended collapse order:

1. hide quick actions first
2. compress search width
3. hide date/time if needed
4. keep user menu and essential status icons

The right rule is not “everything everywhere.” The right rule is “keep the most important shell controls visible.”

## Risks

## Risk: top bar becomes cluttered

Mitigation:

- prioritize icon-first controls
- keep only global or focused-window controls
- move details to activity panel or status bar

## Risk: duplicated search logic

Mitigation:

- wire to the existing search view and state
- do not create a separate top-bar search stack

## Risk: quick actions feel inconsistent

Mitigation:

- only use the existing command registration model
- never show actions that do not map cleanly to the focused window

## Risk: activity panel becomes a second jobs page

Mitigation:

- keep it summary-first
- link users to the Jobs view for full detail

## Recommended First Slice

The best first slice is:

1. restructure `TopBar` into left / center / right zones
2. add global search
3. add theme toggle

That gives the top bar immediate value without overloading it.

After that, add:

4. activity panel
5. connection indicator
6. focused-window quick actions

## Recommendation

The top bar should become a quiet control strip for:

- search
- shell status
- focused work shortcuts

It should not become a dense workspace dashboard.

The strongest implementation path is:

- global search in the center
- small global controls on the right
- focused-window actions on the left

That matches the app's current architecture and gives the highest utility for the least UI noise.
