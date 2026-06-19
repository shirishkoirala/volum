# Preview Viewers Plan

This document lays out how to evolve Volum's current generic preview surface into a shared preview shell with specialized viewers for different file types.

The goal is to improve preview behavior without turning the frontend into a collection of unrelated mini-apps.

## Current State

Today, preview behavior is concentrated in `frontend/src/components/overlay/PreviewModal.tsx`.

That component currently does all of the following in one place:

- decides which file types are previewable
- chooses the rendering mode (image, video, audio, text, PDF, fallback)
- owns preview navigation controls
- owns preview actions such as copy path, share, download, and open raw
- contains type-specific lifecycle behavior

This works for basic previewing, but it creates a few problems:

- file-type behavior is tightly coupled
- adding richer interactions will make `PreviewModal.tsx` harder to maintain
- viewer-specific state has no natural ownership boundary
- toolbar actions are currently global even when they only make sense for one file type

## Target Model

Use one shared preview window or modal shell, then render a specialized viewer inside it based on the current file.

That means:

- one shared preview container
- one shared window header and common actions
- one viewer registry that maps file types to viewer components
- one focused component per viewer type

This is the intended split:

- `PreviewShell`: common chrome, title, navigation, close/download/share/copy path
- `ImageViewer`: image display, fit modes, zoom, pan
- `TextViewer`: text rendering now, editing later
- `PdfViewer`: PDF embed now, richer controls later
- `MediaViewer`: video and audio playback
- `FallbackViewer`: unsupported or blocked previews

This keeps the architecture coherent:

- the shell remains stable
- viewer behavior becomes isolated
- richer controls can be added without bloating one file

## Non-Goals

This plan does not introduce:

- a separate window manager per viewer
- a separate route per viewer
- a full editor suite for all file types
- backend file editing APIs in the first phase

The first step is structural separation, not feature explosion.

## Design Principles

- Keep one preview entry point from `FilesView`, search results, and windowed previews.
- Reuse current preview navigation behavior and current action model.
- Split by interaction model, not by individual extension.
- Prefer shared utilities for file-type detection and preview policy.
- Add editing only where the user benefit clearly justifies it.

## Proposed Frontend Structure

Create a viewer-focused subtree under `frontend/src/components/overlay/preview/`.

Suggested structure:

```text
frontend/src/components/overlay/preview/
├── PreviewShell.tsx
├── PreviewShell.module.css
├── PreviewRouter.tsx
├── types.ts
├── viewers/
│   ├── ImageViewer.tsx
│   ├── ImageViewer.module.css
│   ├── TextViewer.tsx
│   ├── TextViewer.module.css
│   ├── PdfViewer.tsx
│   ├── PdfViewer.module.css
│   ├── MediaViewer.tsx
│   ├── MediaViewer.module.css
│   ├── FallbackViewer.tsx
│   └── FallbackViewer.module.css
└── hooks/
    ├── useTextPreview.ts
    ├── useImageViewerState.ts
    └── usePreviewActions.ts
```

Then reduce `frontend/src/components/overlay/PreviewModal.tsx` to a thin composition layer.

## Component Responsibilities

### `PreviewModal.tsx`

Keep as the public entry point used by the rest of the app.

Responsibilities:

- receives the selected `entry`
- receives navigation callbacks
- renders `Dialog`
- hands off rendering to `PreviewShell`

This file should stop containing per-type rendering branches.

### `PreviewShell.tsx`

Responsibilities:

- common preview header
- shared actions: previous, next, copy path, share, download, open raw, close
- layout framing
- optional viewer-specific action slot
- optional status line such as `3 of 13`

This becomes the stable UI surface around all preview types.

### `PreviewRouter.tsx`

Responsibilities:

- chooses which viewer to render
- resolves preview policy gating
- centralizes logic such as `showImage`, `showVideo`, `showText`, and blocked preview reasons

It should convert file metadata into a `viewerKind`, then render the matching viewer.

### `ImageViewer.tsx`

Phase 1 responsibilities:

- render image safely
- preserve current fit-to-container behavior
- own image-specific loading and error state

Phase 2 enhancements:

- fit modes: contain, actual size
- zoom in/out/reset
- pan for zoomed images
- keyboard shortcuts for zoom and navigation

### `TextViewer.tsx`

Phase 1 responsibilities:

- fetch text content
- abort fetch on entry change/unmount
- show loading and error states
- render text with current monospace presentation

Phase 2 enhancements:

- wrap toggle
- line numbers
- search in file
- copy selected text

Phase 3 enhancement:

- optional edit mode for safe text types

### `PdfViewer.tsx`

Phase 1 responsibilities:

- keep current iframe-based PDF preview
- isolate iframe lifecycle from the shell

Phase 2 enhancements:

- page count and page jump if a PDF library is adopted
- zoom controls if iframe rendering becomes limiting

### `MediaViewer.tsx`

Responsibilities:

- video preview
- audio preview
- media-specific load/error state
- preserve correct aspect handling for video

Phase 2 enhancements:

- playback shortcuts
- position restore per preview session

### `FallbackViewer.tsx`

Responsibilities:

- unsupported preview
- blocked preview because of size/policy
- download/open raw guidance

This prevents the shell from needing fallback-specific markup.

## Shared Types

Add explicit preview-viewer types so the shell and router speak a small, stable API.

Suggested types:

```ts
type PreviewViewerKind =
  | 'image'
  | 'text'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'fallback';

type PreviewViewerProps = {
  entry: FileEntry;
};

type PreviewShellAction = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
};
```

The exact type names can change, but the important point is to stop passing ad hoc behavior around the tree.

## Utility Extraction

Some logic should move out of `PreviewModal.tsx` into utilities or hooks.

### Move to `frontend/src/utils/preview.ts`

- viewer-kind resolution
- preview policy gating
- helper predicates used by the router

Possible additions:

- `getPreviewViewerKind(entry)`
- `getPreviewBlockReason(entry)`
- `canEditText(entry)`

### Add hook helpers

- `useTextPreview(entry, enabled)`
- `usePreviewCopyPath(path)`
- `useImageViewerState()`

This keeps network state and viewer behavior out of the shell.

## Implementation Phases

## Phase 1: Structural Split

Goal: separate the generic shell from the specialized viewers without changing the user-facing feature set much.

Work:

- create `PreviewShell`
- create `PreviewRouter`
- move current image/video/audio/text/PDF/fallback branches into dedicated viewer components
- keep current toolbar actions and current layout
- keep current next/previous behavior
- keep current size-based preview blocking

Expected result:

- no major UX change
- much cleaner code ownership
- safe base for richer viewers later

## Phase 2: Viewer-Specific Controls

Goal: give each viewer controls that make sense for its content.

Work:

- `ImageViewer`: zoom, fit, reset
- `TextViewer`: wrap toggle, search, line numbers if worthwhile
- `PdfViewer`: improve toolbar only if current iframe is too limiting
- `MediaViewer`: better sizing and playback ergonomics
- allow the shell to render a viewer-specific action region

Expected result:

- more capable previews without changing the window model

## Phase 3: Limited Editing

Goal: add editing only where it is low-risk and useful.

Recommended first target:

- plain text
- markdown
- JSON
- config-like text formats

Work:

- add `TextEditorViewer` mode or extend `TextViewer`
- dirty-state tracking
- save/cancel flow
- backend API for safe text save with overwrite protection

Do not start with image editing or PDF editing.

## Phase 4: Backend Support For Editing

This phase is only needed if text editing is approved.

Potential backend work:

- `GET /api/files/raw` remains read path
- add text-safe write endpoint, for example `PUT /api/files/text`
- validate file type or content mode
- preserve `RootGuard` validation
- enforce overwrite rules
- return updated metadata

This should be intentionally narrow. It should not become a generic arbitrary binary write path on day one.

## File-Level Change Plan

These are the likely first files to touch.

### Primary frontend files

- `frontend/src/components/overlay/PreviewModal.tsx`
- `frontend/src/components/overlay/Preview.module.css`
- `frontend/src/utils/preview.ts`

### New frontend files

- `frontend/src/components/overlay/preview/PreviewShell.tsx`
- `frontend/src/components/overlay/preview/PreviewRouter.tsx`
- `frontend/src/components/overlay/preview/types.ts`
- viewer components under `frontend/src/components/overlay/preview/viewers/`
- viewer hooks under `frontend/src/components/overlay/preview/hooks/`

### Likely tests

- `frontend/src/test/preview.test.tsx`
- new viewer-specific tests if the logic becomes large enough

### Optional later backend files

- `backend/internal/api/handlers_files.go`
- `backend/internal/files/service.go` or split file-service text write equivalent

## Testing Plan

## Unit tests

Add or expand tests for:

- viewer-kind selection
- blocked preview routing
- text fetch abort behavior
- image viewer rendering in `StrictMode`
- shell action rendering and disabled state

## Integration tests

Add frontend tests for:

- previous/next navigation still works
- viewer switches correctly across mixed file types
- blocked large file preview lands in `FallbackViewer`

## Browser verification

Verify in the running app:

- image preview opens and persists correctly
- text preview aborts cleanly on close and navigation
- video preview sizes correctly
- PDF preview still renders
- search results and files view both open the same preview shell

## Risks

### Risk: duplicated action logic

If viewer-specific actions are added too early without a stable shell API, the toolbar will fragment.

Mitigation:

- keep common actions in the shell
- expose a narrow extension point for viewer-specific controls

### Risk: over-splitting too early

Too many tiny files can make the preview system harder to follow.

Mitigation:

- only extract components with real behavioral boundaries
- keep simple viewers compact

### Risk: editing broadens scope quickly

Editing introduces persistence, conflict handling, dirty-state, and backend safety concerns.

Mitigation:

- defer editing until the structural split is complete
- start with text-only editing

## Recommended First Slice

The best first implementation slice is:

1. Create `PreviewShell`.
2. Create `PreviewRouter`.
3. Extract `ImageViewer`, `TextViewer`, `PdfViewer`, `MediaViewer`, and `FallbackViewer`.
4. Move text-fetch logic into `useTextPreview`.
5. Keep existing UX unchanged except for any bug fixes discovered during extraction.

That slice is large enough to improve maintainability, but small enough to finish without destabilizing the product.

## Recommendation

Volum should not introduce multiple fully separate preview apps.

It should introduce:

- one shared preview shell
- several specialized viewer components
- a narrow path to text editing later

That gives the product the right level of specialization without duplicating layout, windowing, or navigation logic.
