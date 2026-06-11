# Volum Web Desktop — Window Manager Roadmap

Transform Volum from a single-view web file manager into a GNOME-replacement web desktop with a floating window manager.

---

## Architecture Overview

### Two Modes, One Codebase

| Aspect | Desktop (≥760px) | Mobile (<760px) |
|---|---|---|
| Window behavior | Floating, draggable, resizable | Always full-screen (maximized), no drag/resize |
| Multiple windows | Visible simultaneously, overlapping | One at a time, hidden behind taskbar |
| Title bar | Drag handle + minimize/maximize/close | Simple header with back arrow + title + close |
| Resize handles | 8-point (N,S,E,W,NE,NW,SE,SW) | Hidden |
| Taskbar | Horizontal list of open windows at bottom | Bottom tab bar, tap to switch windows |
| Dock | Left sidebar, app launcher only | Merged into taskbar (launcher + running) |
| Desktop wallpaper | Visible as background behind windows | Hidden (views are always maximized over desktop) |

### Current Component Tree (Home.tsx)
```
<WindowManagerProvider>
  <Home>
    <main.appShell>                    ← grid: 56px sidebar | 44px topbar / 1fr content / 28px status
      <TopBar />                      ← menu bar + title + navigation
      <Dock />                        ← left sidebar: desktop, files, trash, jobs, settings
      <section.workspace>
        <DesktopView />              ← wallpaper + desktop icons + drives
        | <DrivesView />             ← (old full-page drives mode)
        | <TrashView />              ← (old full-page trash mode)
        | <FilesView />              ← (old full-page files mode)
        | <JobsPage />               ← (old full-page jobs mode)
        | <SettingsPanel />          ← (old full-page settings mode)
        <DesktopContextMenu />       ← right-click on desktop
      </section>
      <WindowHost />                  ← floating windows on top
      <StatusBar />                   ← bottom status bar (hidden on some views)
    </main>
  </Home>
</WindowManagerProvider>
```

---

## Phase 0 — Self-Contained Views ✅

**Goal:** Each view owns its own data fetching, state, and visual rendering so it can be opened as a standalone window.

### Done

| Component | Self-contained? | Data source | Notes |
|---|---|---|---|
| FilesView | ✅ | `useFileBrowser` hook | `forwardRef` for shell command proxy |
| TrashView | ✅ | `getTrash()` API | Own selection + restore/delete |
| JobsPage | ✅ | `useJobs` SSE | Own job actions |
| DrivesView | ✅ | `getDevices()` API | Uses ShellContext for navigation |
| SettingsPanel | ✅ | Direct API calls | Already self-contained |

### Key Decisions
- Each view calls its own API endpoints instead of receiving data as props
- SSE connection duplicated between shell and JobsPage — acceptable for now
- `forwardRef`/`useImperativeHandle` pattern for shell→view communication
- ShellContext provides toast, navigate, refresh to all self-contained views

---

## Phase 1 — Window Frame System ✅

**Goal:** Core windowing primitives.

### Done: Types (`WindowManager.tsx`)

```typescript
type WindowState = {
  id: string;              // unique, e.g. "files-1", "trash-1"
  title: string;           // displayed in title bar
  view: React.ReactNode;   // captured on creation (stale closure — fixed in Phase 4)
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
};

type WindowManagerType = {
  windows: WindowState[];
  openWindow(opts: { id, title, view, x?, y?, width?, height? }): void;
  closeWindow(id: string): void;
  focusWindow(id: string): void;
  toggleMinimize(id: string): void;
  toggleMaximize(id: string): void;
  updatePosition(id: string, x, y): void;
  updateSize(id: string, width, height): void;
  toggleWindow(type: string, opts: { title, view, x?, y?, width?, height? }): string;
};
```

### Done: Files

| File | Purpose |
|---|---|
| `contexts/WindowManager.tsx` | Types + context + `useWindowManager` hook |
| `contexts/WindowManagerProvider.tsx` | State management + all callbacks |
| `components/window/WindowFrame.tsx` | DOM: title bar drag, 8-point resize, min/max/close |
| `components/window/WindowFrame.module.css` | Styles for title bar, resize handles, content |
| `components/window/WindowHost.tsx` | Maps `windows` to `<WindowFrame>` instances |

### WindowFrame Behavior
- **Title bar drag**: `onMouseDown` on title bar, track delta on `window.mousemove`, call `updatePosition`. Blocked when maximized.
- **8-point resize**: N/S/E/W/NE/NW/SE/SW handles on edges/corners. Min 300×200. Calls `updatePosition` + `updateSize`.
- **Double-click title bar**: Toggle maximize, save/restore previous rect via `prevRectRef`.
- **Minimize**: Sets `minimized: true`, `display: none` on frame.
- **Maximize**: Sets `position: fixed; top: 0; left: 0; width: 100%; height: 100%`.
- **Z-order**: Click on any part of window calls `focusWindow(id)` → increments z-index.

### Limitations (addressed in later phases)
- Old full-page `activeView` system still exists alongside windows
- Windows capture initial props via closure — don't react to shell state changes
- No taskbar — minimized windows have no way to restore
- No mobile responsiveness in `WindowFrame`
- No keyboard shortcuts

---

## Phase 2 — Window Lifecycle & Multiple Windows ✅

**Goal:** Open views as windows from dock, desktop, and menus. Toggle behavior (focus existing or open new). Unique window IDs per instance.

### Done

| Feature | Implementation |
|---|---|
| `toggleWindow(type, opts)` | Finds existing window by `id.startsWith(type + '-')`, focuses it, or opens new |
| Unique window IDs | `{type}-{n}` via `windowCounts` ref counter |
| Cascade positioning | Each new window offset by `WINDOW_OFFSET = 24px` mod 6 |
| Dock opens windows | Fires `toggleWindow` for files, trash, jobs, settings |
| Desktop icons open windows | `onNavigateTo` → `openFilesWindow(path)`, others → respective toggle |
| TopBar menu opens windows | `onGoFiles`/`onGoTrash`/`onGoJobs`/`onGoSettings` all call window openers |

### Window Openers in Home.tsx

```typescript
const openFilesWindow = useCallback((path?: string) => {
  wm.toggleWindow('files', {
    title: 'Files',
    view: <FilesView currentPath={path ?? viewPref.currentPath} ... />,
    width: 900, height: 600,
  });
}, [wm, viewPref.currentPath, session, favorites, ...]);

const openTrashWindow = useCallback(() => {
  wm.toggleWindow('trash', { title: 'Trash', view: <TrashView />, width: 700, height: 500 });
}, [wm]);

// etc for jobs, settings
```

---

## Phase 3 — Taskbar / Window List

**Goal:** Show running windows so users can see what's open, restore minimized windows, and close windows from a taskbar. Responsive: horizontal list on desktop, bottom tab bar on mobile.

### Design

#### Desktop (≥760px)
- **Taskbar** is a horizontal bar at the bottom of the screen, above the StatusBar
- Each taskbar entry shows: icon (from DockItem type), window title, active indicator, close button
- Left-aligned, scrollable if too many windows
- Click behavior:
  - Window is focused → minimize it
  - Window is minimized → restore + focus it
  - Window is unfocused → focus it
- Right-click on taskbar item → context menu (Close, Minimize, Maximize, Close All)
- **Dock remains** as launcher (left sidebar). Taskbar shows *running* windows, dock shows *available* apps.

#### Mobile (<760px)
- **Dock is hidden** (no left sidebar on mobile)
- **Taskbar becomes a bottom tab bar** replacing the dock's grid-row 4 position
- Each open window = one tab icon
- Tapping a tab: same focus/minimize/restore logic as desktop
- No close button on tabs (swipe to close, or long-press for context menu)
- Only one window visible at a time (the focused/most-recently-active one)
- No desktop background visible — windows fill the full screen
- "Windows" are always maximized (no drag, no resize, just the Frame header + content)

### Files to Create

| File | Purpose |
|---|---|
| `components/layout/Taskbar.tsx` | Taskbar component (desktop horizontal + mobile tab bar) |
| `components/layout/Taskbar.module.css` | Styles: desktop bottom bar, mobile bottom tabs |
| `components/layout/TaskbarItem.tsx` | Single taskbar entry (icon + title + close) |
| `components/layout/TaskbarItem.module.css` | Item styles |

### Files to Modify

| File | Change |
|---|---|
| `contexts/WindowManager.tsx` | Add `minimizeAll?`, `closeAllWindowsOfType?`, `windowCount` getter |
| `contexts/WindowManagerProvider.tsx` | Add helper methods if needed (closeAllWindowsOfType for right-click) |
| `screens/Home.tsx` | Add `<Taskbar>` to shell; conditionally hide `<Dock>` on mobile |
| `components/layout/Dock.tsx` | No change needed (stays on desktop, hidden on mobile) |
| `App.tsx` | Wrap in `<TaskbarProvider>` if needed (could use WindowManager directly) |

### Types (`Taskbar.tsx`)

```typescript
type TaskbarItemProps = {
  id: string;
  title: string;
  icon: string;          // icon URL from DockItem mapping
  minimized: boolean;
  focused: boolean;
  onClick: () => void;
  onClose: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

type TaskbarProps = {
  items: TaskbarItemProps[];
  onActivate: (id: string) => void;  // toggle focus/minimize
  onClose: (id: string) => void;
};
```

### CSS Strategy (`Taskbar.module.css`)

```css
/* Desktop: horizontal bottom bar */
.taskbar {
  grid-column: 2;        /* next to dock */
  grid-row: 3;           /* above status bar */
  display: flex;
  align-items: stretch;
  height: 36px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  overflow-x: auto;
  z-index: 30;
}

/* Mobile: bottom tab bar (replaces dock position) */
@media (max-width: 760px) {
  .taskbar {
    grid-column: 1;
    grid-row: 4;          /* same as dock on mobile */
    height: 56px;
    border-top: 1px solid var(--color-border-light);
    justify-content: center;
  }
}
```

### Edge Cases

| Case | Behavior |
|---|---|
| All windows closed | Taskbar shows "No open windows" or is empty/hidden |
| Minimize last visible window | Desktop background shows behind empty workspace |
| Open window closes | Taskbar item removed, next window focused (or desktop if none left) |
| 20+ windows open | Taskbar scrolls horizontally; mobile shows dots indicator |
| Mobile: window closed from within | Taskbar tab removed, switch to next tab or show desktop |
| Mobile: close last window | Return to desktop (which is hidden behind windows on mobile — Phase 5 removes this) |

### Acceptance Criteria
- [ ] Clicking dock icon → opens window → appears in taskbar
- [ ] Minimized windows can be restored from taskbar
- [ ] Focused window ↔ active taskbar item highlight
- [ ] Close button on taskbar item closes window
- [ ] Mobile: taskbar = bottom tab bar, one full-screen window at a time
- [ ] Mobile: no floating/dragging/resizing

---

## Phase 4 — Reactive Window Content

**Goal:** Windows re-render when shared shell state changes (session, path, favorites, wallpaper, theme) instead of capturing stale closures.

### Problem

Currently, `WindowManagerProvider` stores `React.ReactNode` in `WindowState.view`. The JSX is evaluated once when the window is opened, so changes to `viewPref.currentPath`, `favorites`, `wallpaper`, etc. do not propagate to already-open windows.

### Solution: Render Function Pattern

Replace `view: React.ReactNode` with `render: () => React.ReactNode`:

```typescript
// WindowManager.tsx
type WindowState = {
  id: string;
  title: string;
  render: () => React.ReactNode;   // ← was `view: React.ReactNode`
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
};

type WindowManagerType = {
  // ...
  openWindow(opts: {
    id: string;
    title: string;
    render: () => React.ReactNode;  // ← changed
    x?, y?, width?, height?
  }): void;
  toggleWindow(type: string, opts: {
    title: string;
    render: () => React.ReactNode;  // ← changed
    x?, y?, width?, height?
  }): string;
};
```

### How It Works

1. `openWindow()` stores a `render` function (not JSX result)
2. `WindowHost` calls `win.render()` on every render of `WindowManagerProvider`
   - **But wait**: If `openWindow` captures `render` in a callback that has stable deps (`useCallback(..., [])`), it won't re-evaluate
   - **Better**: The `WindowManagerProvider` itself needs to call `render()` during its own render pass
3. `WindowHost` renders `<>{windows.map(w => <WindowFrame key={w.id} win={w} />)}</>`
4. `WindowFrame` calls `win.render()` inside its JSX: `<div className={styles.content}>{win.render()}</div>`
5. Because `WindowFrame` re-renders when its parent re-renders (or when `win` changes), the `render()` function is called fresh each time

### Optimization

- Since `render()` is called on every shell render (window open/close/focus/any state change), wrap expensive views in `React.memo`:
  - `React.memo(FilesView)` — already the heaviest component
  - `React.memo(TrashView)`
  - `React.memo(JobsPage)`
  - `React.memo(SettingsPanel)`
- The `render` callback itself should be `useCallback`-wrapped in Home.tsx to avoid unnecessary re-renders
- Keep `WindowState` fields (`x`, `y`, `width`, `height`, `minimized`, `maximized`, `zIndex`) stable — they shouldn't trigger re-renders via identity changes

### Files to Modify

| File | Change |
|---|---|
| `contexts/WindowManager.tsx` | Change `view: ReactNode` → `render: () => ReactNode` in both `WindowState` and all API types |
| `contexts/WindowManagerProvider.tsx` | Store `render` instead of `view` in `WindowState` |
| `components/window/WindowFrame.tsx` | Change `{win.view}` → `{win.render()}` |
| `components/window/WindowHost.tsx` | No change needed |
| `screens/Home.tsx` | Change `view: <FilesView .../>` → `render: () => <FilesView .../>` in all 4 window openers |
| `App.tsx` or wrap level | Add `React.memo` to heavy views |

### Acceptance Criteria
- [ ] Changing wallpaper reflects in open Settings window
- [ ] Adding/removing favorites reflects in open FilesView windows
- [ ] Navigating in one FilesView window doesn't affect another
- [ ] No stale closure bugs after Phase 4

---

## Phase 5 — Remove Old View System

**Goal:** The full-page `activeView`/`showingTrash`/`showingSettings` system is dead. Windows are the only way to view content. The desktop is always the background.

### What to Remove

| Symbol | Location | Lines |
|---|---|---|
| `showingTrash` state | `useNavigation.ts` | Implementation + export |
| `showingSettings` state | `useNavigation.ts` | Implementation + export |
| `showingJobs` state | `useNavigation.ts` | Implementation + export |
| `showingMyPC` state | `useNavigation.ts` | Implementation + export |
| `selectedDriveName` state | `useNavigation.ts` | Implementation + export |
| `activeView` computed | `useNavigation.ts` | Implementation + export |
| `topBarTitle` computed | `useNavigation.ts` | Entire function |
| `ActiveView` type | `useNavigation.ts` | Type definition |
| Conditional view rendering | `Home.tsx` lines 283-330 | `nav.activeView === 'desktop' ? <DesktopView> : ...` |
| `showStatusBar` derivation | `Home.tsx` line 228 | No longer needed — always visible or always hidden |
| `nav.setShowingTrash/setShowingSettings/setShowingJobs/setShowingMyPC` | `Home.tsx` | All callsites |
| `DrivesView` full-page render | `Home.tsx` | `nav.activeView === 'drives'` branch |
| `useNavStack` | `Home.tsx`, `hooks/useNavStack.ts` | Navigation now window-based |
| `StatusBar` visibility prop | `StatusBar.tsx` | `visible` prop + its logic |

### What to Keep

| Symbol | Why |
|---|---|
| `DesktopView` | Always rendered as the background |
| `Dock` items array + badge logic | Used for window launcher badges |
| `StatusBar` component | Show file/storage info for focused window |
| `DrivesView` component | Still usable via ShellContext or as a window |
| `FilesView` full-page render | Remove — windows replace this |
| `viewPref.currentPath` | Still needed for dock "Desktop → Files" button |

### After Removal: Home.tsx Structure

```
<main.appShell>
  <TopBar />                  {/* simpler — no conditional menus based on activeView */}
  <Dock />                    {/* always launcher, always visible on desktop */}
  <DesktopView />             {/* always the background */}
  <WindowHost />              {/* windows floating on top */}
  <Taskbar />                 {/* window list at bottom */}
  <StatusBar />               {/* always visible, shows info for focused window */}
</main>
```

### Edge Cases

| Case | Behavior |
|---|---|
| No windows open | DesktopView visible full screen, Taskbar shows empty |
| Browser refresh | Desktop only (no full-page view restored). Window state lost unless persisted (Phase 6) |
| Mobile | DesktopView hidden behind maximized windows; empty state shows desktop with launcher |

### Acceptance Criteria
- [ ] No `activeView` or `showing*` state exists
- [ ] Desktop is always the background
- [ ] All content access is through windows
- [ ] `nav.activeView` and `useNavigation` conditional rendering completely removed
- [ ] TypeScript + lint + build pass

---

## Phase 6 — Keyboard & UX Polish

**Goal:** Keyboard shortcuts for window management and general UX polish.

### Shortcuts

| Shortcut | Action | Context |
|---|---|---|
| `Ctrl+W` / `Cmd+W` | Close focused window | Always |
| `Alt+F4` | Close focused window | Always |
| `Alt+Tab` | Cycle through open windows (next) | Always |
| `Alt+Shift+Tab` | Cycle through open windows (prev) | Always |
| `Win+↑` | Maximize focused window | Always |
| `Win+↓` | Restore / minimize focused window | Always |
| `Win+←` | Snap to left half | ≥760px |
| `Win+→` | Snap to right half | ≥760px |
| `Escape` | Close context menus, deselect | Always |
| `F5` / `Ctrl+R` | Refresh focused window content | Always |
| `Ctrl+N` | New file window | Always |
| `Ctrl+Shift+N` | New folder (delegates to focused FilesView) | When FilesView focused |

### Implementation

- Single `useWindowShortcuts(session?)` hook in Home.tsx
- Reads `wm.windows` + `wm.focusedWindowId` (need to track focused window)
- Listens on `window.keydown`, checks for modifiers

### Additional State Needed

```typescript
// Add to WindowManager context
focusedWindowId: string | null;
```

Already somewhat tracked via z-order (highest zIndex is focused), but need explicit tracking for keyboard-accessible focus cycling.

### Snap Behavior

- `Win+←`: Set `x=0, width=50vw`
- `Win+→`: Set `x=50vw, width=50vw`
- Save previous rect for restore on `Win+↑` or manual resize

### Window State Persistence

```typescript
const STORAGE_KEY = 'volum_window_state';

type PersistedWindowState = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
};

// Save on window close / position change (debounced)
function saveWindowState(windows: WindowState[]) {
  const data = windows.map(w => ({
    id: w.id, title: w.title, x: w.x, y: w.y,
    width: w.width, height: w.height, maximized: w.maximized,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Load on startup
function loadWindowState(): PersistedWindowState[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
```

Only persist **window geometry**, not content (content is restored via `toggleWindow` on demand). On page load, restore desktop + taskbar but don't reopen content windows unless user re-launches them.

### Window Title Updates

- FilesView should update `WindowState.title` when navigating to a new path
- Need: `updateWindowTitle(id, title)` in WindowManager

```typescript
// WindowManager type
updateWindowTitle: (id: string, title: string) => void;
```

- FilesView calls this via ShellContext or direct `useWindowManager()` inside

### Mobile Considerations

- No keyboard shortcuts on mobile (no keyboard)
- Alt+Tab not applicable — taskbar tap serves same purpose
- Window state persistence applies on mobile too (geometry meaningless but saved anyway)

### Files to Create/Modify

| File | Action |
|---|---|
| `hooks/useWindowShortcuts.ts` | Create: keyboard shortcut handler |
| `contexts/WindowManager.tsx` | Add `focusedWindowId`, `updateWindowTitle` |
| `contexts/WindowManagerProvider.tsx` | Implement focused tracking, persistence, title updates |
| `screens/Home.tsx` | Add `useWindowShortcuts` |
| `pages/FilesView.tsx` | Call `updateWindowTitle` on navigation |
| `components/layout/StatusBar.tsx` | Show info for focused window instead of `activeView` |

### Acceptance Criteria
- [ ] Ctrl+W closes focused window
- [ ] Alt+Tab cycles windows
- [ ] Win+↑/↓/←/→ work for window management
- [ ] Window positions restored after refresh
- [ ] File window title shows current directory name
- [ ] All shortcuts work without interfering with file input shortcuts

---

## Phase 7 — Desktop App Launcher

**Goal:** GNOME-style Activities Overview — press Super key to see all available apps as a grid, search to filter, click to launch as window.

### Design

- **Trigger**: Super/Windows key, hot corner (top-left), or dedicated "Launcher" dock item
- **Overlay**: Full-screen transparent backdrop with centered app grid
- **Apps**: Desktop (return to desktop), Files, Trash, Transfers, Settings, Drives
- **Each app**: Large icon (64px) + label below, arranged in responsive grid
- **Search**: Auto-focused input at top, filters apps by name
- **Click on app**: Opens as window (calls `toggleWindow(type, ...)`)
- **Click on desktop with no open window**: Launch the app directly
- **Escape**: Close launcher
- **Recent files** (future): Recently accessed files shown below apps

### Implementation

```
components/overlay/AppLauncher.tsx
components/overlay/AppLauncher.module.css
```

### State

```typescript
type LauncherApp = {
  id: string;
  label: string;
  icon: string;           // icon URL
  description: string;    // tooltip
};

type AppLauncherProps = {
  open: boolean;
  onClose: () => void;
  onLaunchApp: (id: string) => void;
  apps: LauncherApp[];
};
```

### Mobile

- No app launcher overlay on mobile (no Super key, no hot corner)
- Dock/taskbar serves as launcher on mobile
- Could be triggered by a "Show all apps" button in the taskbar

### Acceptance Criteria
- [ ] Pressing Super key opens launcher
- [ ] Typing filters apps
- [ ] Click launches window
- [ ] Escape closes
- [ ] Window opens in default position (or cascade)

---

## Phase 8 — Window Manager Tests

**Goal:** Ensure window manager doesn't regress.

### Test Plan

| Area | Tests |
|---|---|
| `WindowManagerProvider` | Open window, close window, focus, toggleMinimize, toggleMaximize, updatePosition, updateSize, toggleWindow |
| `toggleWindow` | Unique IDs, find existing, cascade positioning |
| `WindowFrame` | Drag calls updatePosition, resize calls updateSize, minimize sets display:none, maximize fills screen |
| `Taskbar` | Renders items, click focuses, close button works, active indicator |
| Mobile | Taskbar renders as tabs, cannot drag, cannot resize |
| Shortcuts | Ctrl+W closes, Alt+Tab cycles, Win+arrows snap |

### Test Framework
- Vitest + jsdom (existing setup in `frontend/src/test/`)
- React Testing Library for component tests
- `window.getComputedStyle` checks for CSS

### Files to Create
- `frontend/src/test/window-manager/WindowManagerProvider.test.ts`
- `frontend/src/test/window-manager/WindowFrame.test.ts`
- `frontend/src/test/window-manager/Taskbar.test.ts`
- `frontend/src/test/window-manager/useWindowShortcuts.test.ts`

---

## Design Principles

1. **KISS** — straightforward solutions, no over-engineering
2. **YAGNI** — implement only what's currently needed
3. **Progressive enhancement** — each phase builds on the previous without breaking it
4. **CSS Modules** — every component has `*.module.css`, Vite auto-hashes class names
5. **No runtime CSS-in-JS** — all styling via CSS Modules + CSS custom properties
6. **Mobile-first responsive** — the 760px breakpoint governs two fundamentally different window modes
7. **No drag/resize on mobile** — windows are always full-screen, taskbar provides navigation

---

## Complete File Map

### Current Files

| File | Phase | Notes |
|---|---|---|
| `contexts/WindowManager.tsx` | 1 | Types + context + hook |
| `contexts/WindowManagerProvider.tsx` | 1 | State management |
| `components/window/WindowFrame.tsx` | 1 | Window chrome + drag + resize |
| `components/window/WindowFrame.module.css` | 1 | Window chrome styles |
| `components/window/WindowHost.tsx` | 1 | Renders all windows |
| `screens/Home.tsx` | 0, 2 | Shell + window openers |

### Future Files

| File | Phase | Purpose |
|---|---|---|
| `components/layout/Taskbar.tsx` | 3 | Window list (desktop + mobile) |
| `components/layout/Taskbar.module.css` | 3 | Taskbar styles |
| `components/layout/TaskbarItem.tsx` | 3 | Single taskbar entry |
| `components/layout/TaskbarItem.module.css` | 3 | Item styles |
| `hooks/useWindowShortcuts.ts` | 6 | Keyboard shortcuts |
| `components/overlay/AppLauncher.tsx` | 7 | Super key app grid |
| `components/overlay/AppLauncher.module.css` | 7 | Launcher styles |
| `test/window-manager/*.test.ts` | 8 | Tests |

### Files to Modify (Future Phases)

| File | Phase | Change |
|---|---|---|
| `contexts/WindowManager.tsx` | 4, 6 | `view`→`render()`, add `focusedWindowId`, `updateWindowTitle` |
| `contexts/WindowManagerProvider.tsx` | 4, 6 | Render functions, focus tracking, persistence |
| `components/window/WindowFrame.tsx` | 3, 4, 6 | Mobile: no drag/resize; `view`→`render()`; title updates |
| `components/window/WindowFrame.module.css` | 3 | Mobile: no resize handles, simplified title bar |
| `components/window/WindowHost.tsx` | 3 | Mobile: one window at a time |
| `screens/Home.tsx` | 3, 5 | Add Taskbar, remove old view system |
| `hooks/useNavigation.ts` | 5 | Gut old view switching state |
| `components/layout/Dock.module.css` | 3 | Hide on mobile |

---

## Glossary

| Term | Definition |
|---|---|
| Window | A Frame (chrome) + Content (view) managed by WindowManager |
| WindowFrame | The draggable title bar + resize handles + content area |
| WindowHost | Container that renders all WindowFrames (desktop) or one (mobile) |
| Taskbar | Bottom bar showing open windows (desktop list / mobile tabs) |
| Dock | Left sidebar app launcher (desktop only) |
| toggleWindow | Opens a new window or focuses an existing one of the same type |
| Cascade | Offset successive windows by 24px to avoid perfect overlap |
| Self-contained view | A view that owns its data fetching, state, and overlays (no parent props) |
| ShellContext | Shared context providing toast, navigate, refresh to self-contained views |
