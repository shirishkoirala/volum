# Volum Web Desktop — Window Manager Roadmap

Transform Volum from a single-view web file manager into a desktop experience with a floating window manager on desktop, while keeping the simple full-page app switcher on mobile.

---

## Two-Mode Architecture

The codebase supports two fundamentally different interaction models depending on viewport width:

| Aspect | Desktop (≥760px) | Mobile (<760px) |
|---|---|---|
| **Windowing** | Floating windows managed by WindowManager | No windows — classic full-page views |
| **Taskbar** | Bottom bar shows open windows, click to focus/minimize | Hidden |
| **Dock** | Left sidebar app launcher | Bottom tab bar (app switcher) |
| **Desktop background** | Always visible wallpaper | Hidden when a view is active |
| **Navigation** | Open/close/focus windows via Dock, desktop icons, menus | Dock tab switches full-page views |
| **View state** | `WindowState[]` array | `activeView` + `showing*` booleans |

### How the Bifurcation Works

```typescript
// Home.tsx rendering logic (Phase 5 end state)

if (isMobile) {
  // Mobile: old full-page view system
  return (
    <main className={styles.appShellMobile}>
      <TopBar />
      <section className={styles.workspace}>
        {nav.activeView === 'files' && <FilesView ... />}
        {nav.activeView === 'trash' && <TrashView />}
        {nav.activeView === 'jobs' && <JobsPage ... />}
        {nav.activeView === 'settings' && <SettingsPanel ... />}
        {nav.activeView === 'drives' && <DrivesView />}
        {nav.activeView === 'desktop' && <DesktopView ... />}
      </section>
      <StatusBar />
      <Dock />  {/* bottom tab bar on mobile */}
    </main>
  );
} else {
  // Desktop: window-based
  return (
    <main className={styles.appShellDesktop}>
      <TopBar />
      <Dock />  {/* left sidebar launcher */}
      <DesktopView />  {/* always the background */}
      <WindowHost />   {/* floating windows on top */}
      <Taskbar />      {/* open window list */}
      <StatusBar />
    </main>
  );
}
```

### `isMobile` Detection

```typescript
function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    window.matchMedia('(max-width: 760px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}
```

---

## Phase 0 — Self-Contained Views ✅

**Goal:** Each view owns its own data fetching and state so it can be opened as a standalone window or full-page view interchangeably.

### Done

| Component | Self-contained? | Data | Notes |
|---|---|---|---|
| FilesView | ✅ | `useFileBrowser` hook | `forwardRef` for shell command proxy |
| TrashView | ✅ | `getTrash()` API | Own selection + restore/delete |
| JobsPage | ✅ | `useJobs` SSE | Own job actions |
| DrivesView | ✅ | `getDevices()` API | Uses ShellContext for navigation |
| SettingsPanel | ✅ | Direct API calls | Already self-contained |

### Key Decisions
- Each view calls its own API endpoints instead of receiving data as props
- SSE connection duplicated between shell and JobsPage — acceptable waste
- `forwardRef`/`useImperativeHandle` for shell→view communication (AppMenuBar → FilesView)
- ShellContext provides toast, navigate, refresh to all self-contained views

---

## Phase 1 — Window Frame System ✅

**Goal:** Core windowing primitives — draggable, resizable, minimizable windows with title bars.

### Types (`contexts/WindowManager.tsx`)

```typescript
type WindowState = {
  id: string;             // e.g. "files-1", "trash-1"
  title: string;
  icon: string;           // icon URL for taskbar
  render: () => React.ReactNode;
  x: number; y: number;
  width: number; height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
};
```

### Files

| File | Purpose |
|---|---|
| `contexts/WindowManager.tsx` | Types + context + `useWindowManager` hook |
| `contexts/WindowManagerProvider.tsx` | State management + all callbacks |
| `components/window/WindowFrame.tsx` | DOM: title bar drag, 8-point resize, min/max/close |
| `components/window/WindowFrame.module.css` | Styles for title bar, resize handles, content |
| `components/window/WindowHost.tsx` | Maps `windows` to `<WindowFrame>` instances |

### Mobile: WindowFrame is NOT rendered (WindowHost returns null)

---

## Phase 2 — Window Lifecycle ✅

**Goal:** Open views as windows from dock, desktop, and menus. Toggle behavior. Unique IDs.

### Done

| Feature | Detail |
|---|---|
| `toggleWindow(type, opts)` | Find existing by prefix (`files-*`), focus, or open new |
| Unique IDs | `{type}-{n}` via `windowCounts` ref |
| Cascade | Offset 24px per window, mod 6 |
| Dock opens windows | `openFilesWindow()`, `openTrashWindow()`, etc. |
| Desktop icons open windows | `onNavigateTo` → `openFilesWindow(path)` |
| TopBar menu opens windows | All view navigation calls window openers |

---

## Phase 3 — Taskbar ✅

**Goal:** Show open windows in a taskbar so users can see what's open and switch between them.

### Done

| Feature | Desktop | Mobile |
|---|---|---|
| Taskbar | Bottom horizontal bar showing open windows | Hidden |
| Click behavior | Focused → minimize, minimized → restore, unfocused → focus | N/A |
| Close button | On hover (x) | N/A |
| Icon + title | Each item shows both | N/A |
| Active indicator | Blue underline for focused window | N/A |

### Files

| File | Purpose |
|---|---|
| `components/layout/Taskbar.tsx` | Taskbar component |
| `components/layout/Taskbar.module.css` | Styles: desktop bottom bar, mobile hidden |

### Mobile: Taskbar not rendered

### Fix needed: Restore Dock on mobile
Phase 3 currently hides the Dock on mobile (`display: none`) — this was premature. Now that mobile uses the old view system, the Dock MUST be restored on mobile as a bottom tab bar.

**Change**: Revert Dock.module.css mobile breakpoint to show the dock as a bottom tab bar (horizontal, centered, at grid-row 4).

---

## Phase 4 — Reactive Window Content

**Goal:** Windows re-render when shared shell state changes instead of capturing stale closures.

### Problem

`WindowState.render` is stored as a function, but if `render` captures variables that change (like `viewPref.currentPath`, `favorites`, `wallpaper`), the captured closure becomes stale. The window content doesn't update when shell state changes because `render` is only evaluated once.

### Solution

```typescript
// In Home.tsx — window openers
const openFilesWindow = useCallback((path?: string) => {
  wm.toggleWindow('files', {
    title: 'Files',
    icon: filesIconUrl(),
    render: () => (                          // ← render function, not JSX
      <FilesView
        currentPath={path ?? viewPref.currentPath}
        session={session}
        favorites={favorites}
        onNavigate={navActions.navigateTo}
        onBack={navActions.goBack}
        onAddFavorite={addFavorite}
        onRemoveFavorite={removeFavorite}
      />
    ),
    width: 900, height: 600,
  });
  // NOTE: `wm` is a stable reference. The render() function will be called
  // by WindowHost on every shell re-render, so it always gets fresh values.
  // However, `path` is captured locally. If `openFilesWindow` is called again
  // with a different path, a NEW window opens (toggleWindow maps by type).
  // The open window's path stays at the value from when it was opened.
}, [wm, viewPref.currentPath, session, favorites, navActions, addFavorite, removeFavorite]);
```

### How It Actually Works

1. `WindowManagerProvider` stores `render: () => ReactNode` instead of `view: ReactNode`
2. `WindowHost` renders `<WindowFrame key={win.id} win={win} />` for each window
3. `WindowFrame.content` calls `{win.render()}`
4. Because `WindowFrame` re-renders when `WindowHost` re-renders (window list changes, focus changes, etc.), `render()` is called fresh
5. However, `render()` is the SAME function reference captured at creation time — it closes over the values at the time `toggleWindow` was called
6. **Key insight**: `win.render` IS called fresh on each `WindowManagerProvider` render... but wait. The `render` is stored as a field on the state object. React state updates cause re-render of the provider, which re-renders WindowHost, which re-renders WindowFrame, which calls `win.render()`. So the function IS re-evaluated.

BUT: If the `render` function closes over `viewPref.currentPath` from when `toggleWindow` was called, then even if `viewPref.currentPath` changes later, the captured closure still has the old value. That's the stale closure problem.

**The fix**: Ensure the `render` function doesn't close over specific values but instead reads from React context or gets recreated. The simplest fix is to NOT memoize `openFilesWindow` with stale values, or to use a ref to access the latest values.

#### Approach: Store unstable `render` in a ref

Instead of storing `render: () => ReactNode` in state, the provider stores it in a ref that gets replaced on every render:

```typescript
// WindowManagerProvider
const renderersRef = useRef<Record<string, () => ReactNode>>({});

// Each render cycle — re-create render fns with up-to-date closures
// Called from Home.tsx effect or passed via context
function setRenderer(id: string, render: () => ReactNode) {
  renderersRef.current[id] = render;
}
```

Actually, this is getting complicated. The simplest KISS solution:

**Use keys on WindowFrame** — when a window's render function changes, the key needs to change too. Or, use the window's identity as the key and pass a `version` counter that increments when the window config changes.

Actually the SIMPLEST approach is:

1. Don't store `view` or `render` in window state at all
2. Instead, store `type` and `params` (a config object)
3. WindowHost maps `{type, params}` → actual component rendering

```typescript
type WindowState = {
  id: string;
  type: 'files' | 'trash' | 'jobs' | 'settings';
  params: Record<string, any>;   // path, etc.
  // ... geometry fields
};

// In Home.tsx (renders dynamically based on all windows)
function renderWindow(win: WindowState): ReactNode {
  switch (win.type) {
    case 'files': return <FilesView currentPath={win.params.path ?? viewPref.currentPath} ... />;
    case 'trash': return <TrashView />;
    // etc.
  }
}
```

This way, every time Home re-renders, ALL windows get freshly generated JSX with current prop values. No stale closures. This is the cleanest approach.

### Files to Modify

| File | Change |
|---|---|
| `contexts/WindowManager.tsx` | Change `view`/`render` → `type: string` + `params: Record<string, unknown>` |
| `contexts/WindowManagerProvider.tsx` | Store type/params instead of view/render |
| `components/window/WindowFrame.tsx` | Change `{win.view}` → `{win.render?.()}` or take render as prop |
| `components/window/WindowHost.tsx` | Take `renderWindow: (win) => ReactNode` prop; call it for each window |
| `screens/Home.tsx` | Write `renderWindow` switch; pass to WindowHost |

### Alternative (Simpler but Less Clean)

Just replace `view: ReactNode` with `render: () => ReactNode` everywhere, and accept that the render function closes over the values at creation time. For views like JobsPage and SettingsPanel that don't take dynamic props from the shell, this is fine. For FilesView (which takes `currentPath`, `favorites`, etc.), the stale closure means opening a window captures the path — which is actually desired behavior (each FilesView window should be independent). The wallpaper/theme changes would still be stale, but we can fix those separately.

**Decision**: Go with the `type`+`params` pattern. It's KISS, handles all cases, no closure bugs.

---

## Phase 5 — Remove Old View System from Desktop

**Goal:** Desktop uses windows exclusively. Mobile keeps the old full-page view system.

### Desktop: What to Change

| State/Variable | Action |
|---|---|
| `showingTrash` / `setShowingTrash` | **Keep** (for mobile) |
| `showingSettings` / `setShowingSettings` | **Keep** (for mobile) |
| `showingJobs` / `setShowingJobs` | **Keep** (for mobile) |
| `showingMyPC` / `setShowingMyPC` | **Keep** (for mobile) |
| `selectedDriveName` | **Keep** (for mobile) |
| `activeView` computed | **Keep** (for mobile) |
| `topBarTitle` computed | **Keep** (for mobile) |
| `ActiveView` type | **Keep** (for mobile) |
| `showStatusBar` derivation | **Keep** (for mobile) |
| `useNavStack` | **Keep** (for mobile) |
| Desktop: conditional view rendering | **Remove** — DesktopView always background |
| Desktop: full-page FilesView, TrashView etc. | **Remove** — use windows |
| Desktop: `StatusBar` visibility logic | **Remove** — always visible on desktop |
| `nav.setShowingTrash` calls from desktop | **Remove** — desktop uses openTrashWindow |
| `DesktopContextMenu` | **Keep** — still used on desktop |

### Desktop Home.tsx Structure (after Phase 5)

```typescript
if (isMobile) {
  // ═══ MOBILE: old full-page views ═══
  return (
    <main className={styles.appShellMobile}>
      <TopBar ... />
      <Dock items={nav.dockItems} onActivate={handleDockActivate} />
      <section className={styles.workspace} onClick={selection.handleWorkspaceClick}>
        {nav.activeView === 'desktop' && <DesktopView ... />}
        {nav.activeView === 'drives' && <DrivesView />}
        {nav.activeView === 'files' && <FilesView ref={filesViewRef} ... />}
        {nav.activeView === 'trash' && <TrashView />}
        {nav.activeView === 'jobs' && <JobsPage ... />}
        {nav.activeView === 'settings' && <SettingsPanel ... />}
        {menus.desktopContextMenu && <DesktopContextMenu ... />}
      </section>
      <StatusBar visible={isMobile ? showStatusBar : false} ... />
    </main>
  );
} else {
  // ═══ DESKTOP: window-based ═══
  return (
    <main className={styles.appShellDesktop}>
      <TopBar ... menuHandlers={{...}} />
      <Dock items={nav.dockItems} onActivate={handleDesktopDockActivate} />
      <DesktopView ... />
      <WindowHost renderWindow={renderWindow} />
      <Taskbar />
      <StatusBar visible={true} ... />
    </main>
  );
}
```

### Mobile Home.tsx Structure (after Phase 5)

Identical to current Home.tsx with old view system. The dock stays as a bottom tab bar. No windows, no taskbar.

### Other Changes

| File | Change |
|---|---|
| `hooks/useNavigation.ts` | Keep all state (used by mobile) |
| `hooks/useNavStack.ts` | Keep (used by mobile) |
| `hooks/useDesktopActions.ts` | Simplify — mobile-only dock actions |
| `components/layout/Dock.module.css` | Restore mobile breakpoint (Phase 3 hid it) |
| `components/layout/Taskbar.tsx` | Already hidden on mobile via CSS |
| `components/window/WindowHost.tsx` | Return null on mobile |
| `screens/Home.tsx` | Major refactor — bifurcate render path |
| `screens/Home.module.css` | `.appShellDesktop` and `.appShellMobile` grids |

### Desktop Grid (`Home.module.css`)

```css
.appShellDesktop {
  grid-template-rows: 44px 1fr 36px 28px;
  grid-template-columns: 56px minmax(0, 1fr);
}
.workspaceDesktop {
  grid-column: 2;
  grid-row: 2;
}
```

### Mobile Grid

```css
.appShellMobile {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 44px minmax(0, 1fr) 24px 64px;
}
```

### Acceptance
- [ ] Desktop: no full-page view switching
- [ ] Desktop: all content accessed through windows
- [ ] Desktop: DesktopView always visible as background
- [ ] Mobile: Dock at bottom, tap to switch views
- [ ] Mobile: no windows, no taskbar
- [ ] Mobile: everything works as before Phase 1

---

## Phase 6 — Keyboard & UX Polish (Desktop Only)

**Goal:** Keyboard shortcuts for window management. No mobile shortcuts (no keyboard).

### Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+W` / `Cmd+W` | Close focused window |
| `Alt+F4` | Close focused window |
| `Alt+Tab` | Cycle forward through windows |
| `Alt+Shift+Tab` | Cycle backward through windows |
| `Win+↑` | Maximize focused window |
| `Win+↓` | Restore / minimize focused window |
| `Win+←` | Snap to left half |
| `Win+→` | Snap to right half |
| `Escape` | Close context menus, deselect |
| `F5` / `Ctrl+R` | Refresh focused window content |

### Implementation

- `hooks/useWindowShortcuts.ts` — single hook
- Reads `windowManager.windows` + `focusedWindowId`
- Listens on `window.keydown`, checks modifiers
- Desktop only (check `isMobile` in hook)

### Additional Types Needed

```typescript
// Add to WindowManager
focusedWindowId: string | null;
updateWindowTitle: (id: string, title: string) => void;
```

### Window State Persistence

```typescript
const STORAGE_KEY = 'volum_window_state';
type PersistedWindow = {
  type: string; title: string; icon: string;
  x: number; y: number; width: number; height: number;
  maximized: boolean;
};
// Save debounced on position/size changes
// Load on startup — restore geometry data only (no content)
// User re-launches content via dock/desktop icons
```

### Mobile
- No keyboard shortcuts (no physical keyboard)
- Window state persistence irrelevant (no windows)

---

## Phase 7 — Tests

**Goal:** Ensure window manager doesn't regress.

### Test Plan

| Area | Tests |
|---|---|
| `WindowManagerProvider` | Open, close, focus, minimize, maximize, position, size, toggleWindow |
| `toggleWindow` | Unique IDs, find existing, cascade |
| `WindowFrame` | Drag calls updatePosition, resize calls updateSize, maximize/minimize buttons |
| `Taskbar` | Renders items, click focuses, close button, active indicator |
| `useIsMobile` | Returns correct boolean, reacts to viewport changes |
| Desktop mode | No full-page views, windows only |
| Mobile mode | No windows, dock-only, full-page views work |
| Mixed | Resize from mobile to desktop and back — graceful transition |

### Files
- `frontend/src/test/window-manager/*.test.ts`

---

## File Map (Complete)

### Core (Phases 1-2)

| File | Status |
|---|---|
| `contexts/WindowManager.tsx` | ✅ Done |
| `contexts/WindowManagerProvider.tsx` | ✅ Done |
| `components/window/WindowFrame.tsx` | ✅ Done |
| `components/window/WindowFrame.module.css` | ✅ Done |
| `components/window/WindowHost.tsx` | ✅ Done |

### Taskbar (Phase 3)

| File | Status |
|---|---|
| `components/layout/Taskbar.tsx` | ✅ Done |
| `components/layout/Taskbar.module.css` | ✅ Done |

### Phase 4

| File | Change |
|---|---|
| `contexts/WindowManager.tsx` | Replace `view`/`render` with `type: string` + `params` |
| `contexts/WindowManagerProvider.tsx` | Store type/params; remove view/render |
| `components/window/WindowFrame.tsx` | Content calls `win.render()` or window host passes render |
| `components/window/WindowHost.tsx` | Take `renderWindow` prop |
| `screens/Home.tsx` | `renderWindow` switch function |

### Phase 5

| File | Change |
|---|---|
| `screens/Home.tsx` | Bifurcate desktop vs mobile render paths |
| `screens/Home.module.css` | `.appShellDesktop` + `.appShellMobile` grids |
| `components/layout/Dock.module.css` | Restore mobile breakpoint |
| `components/layout/Dock.tsx` | No change needed |
| `components/layout/StatusBar.tsx` | `visible` prop controlled by mode |
| `hooks/useNavigation.ts` | No change (still used by mobile) |

### Phase 6

| File | Action |
|---|---|
| `hooks/useWindowShortcuts.ts` | Create |
| `contexts/WindowManager.tsx` | Add `focusedWindowId`, `updateWindowTitle` |
| `contexts/WindowManagerProvider.tsx` | Focus tracking, persistence |
| `screens/Home.tsx` | Wire shortcuts hook |

### Phase 7

| File | Action |
|---|---|
| `frontend/src/test/window-manager/*.test.ts` | Create test files |

---

## Design Principles

1. **KISS** — straightforward solutions, no over-engineering
2. **YAGNI** — implement only what's currently needed
3. **Progressive enhancement** — each phase builds on the previous without breaking it
4. **CSS Modules** — every component has `*.module.css`
5. **No runtime CSS-in-JS** — all styling via CSS Modules + CSS custom properties
6. **Bifurcated mobile/desktop** — windows are desktop-only; mobile keeps simple full-page views
7. **Mobile uses the simplest path** — no window management, no floating, no resizing

---

## Glossary

| Term | Definition |
|---|---|
| Window | A Frame (chrome) + Content (view) managed by WindowManager |
| WindowFrame | The draggable title bar + resize handles + content area |
| WindowHost | Container that renders all WindowFrame instances |
| Taskbar | Bottom bar showing open windows (desktop only) |
| Dock | Launcher — left sidebar on desktop, bottom tab bar on mobile |
| toggleWindow | Opens a new window or focuses an existing one of the same type |
| Cascade | Offset successive windows by 24px |
| Self-contained view | A view that owns its data fetching, state, and overlays |
| ShellContext | Shared context: toast, navigate, refresh for views |
| `isMobile` | `window.matchMedia('(max-width: 760px)')` — controls the bifurcation |
| ActiveView | Mobile-only: which full-page view is currently shown |
