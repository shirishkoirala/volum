# Volum Visual Consistency Audit

**Date:** 2026-07-03
**Scope:** Frontend (`frontend/src/`) — design tokens, CSS modules, component rendering
**Method:** Static CSS analysis + Playwright headless-browser screenshots (1440×900, light + dark themes)
**Live screenshots:** `/tmp/volum-screens/*.png` (login, desktop, files, settings, jobs, trash, service window)

---

## Summary

The design system (`tokens.css` + `global.css`) is well-structured with a comprehensive token scale. Most of the codebase uses tokens consistently. The glass-morphism aesthetic is applied coherently across the top bar, dock, and window frames, and dark mode color tokens are well-tuned with no contrast issues.

However, there is measurable drift in several areas: broken token references (live bugs), hardcoded values that bypass the token system, an inconsistent glass-blur scale, mixed `rem`/`px` typography, an ad-hoc z-index ladder, and several issues specific to the in-app browser (`ServiceWindow`).

| Severity | Count |
|----------|-------|
| 🔴 High | 3 |
| 🟡 Medium | 9 |
| 🟢 Low | 10 |

---

## 🔴 High Severity

### V1. Broken `--color-primary` token references in ConflictDialog (live bug)

**File:** `frontend/src/components/overlay/ConflictDialog.module.css:132,133,137,138,139`

`ConflictDialog` references `--color-primary` (5 uses) and `--color-text-on-primary` (1 use). **Neither token exists** in `tokens.css` — the design system uses `--color-brand` and `--color-on-accent`. As a result, `background` and `border-color` fall back to `transparent`/`initial`.

```css
.choiceBtn:hover {
  border-color: var(--color-primary);   /* undefined → transparent */
  color: var(--color-primary);          /* undefined → inherited */
}
.choiceBtnActive {
  background: var(--color-primary);     /* undefined → transparent bg */
  border-color: var(--color-primary);
  color: var(--color-text-on-primary, #fff);
}
```

**Impact:** The active/hover state of conflict-resolution buttons is broken — the selected choice button has no visible brand background.

**Fix:** Replace all `--color-primary` → `--color-brand`, and `--color-text-on-primary` → `--color-on-accent`:
```css
.choiceBtn:hover {
  border-color: var(--color-brand);
  color: var(--color-brand);
}
.choiceBtnActive {
  background: var(--color-brand);
  border-color: var(--color-brand);
  color: var(--color-on-accent);
}
```

---

### V2. "May block embedding" hint is always visible in the in-app browser (confirmed via screenshot)

**File:** `frontend/src/components/window/ServiceWindow.tsx:49-51`

```tsx
<div className={styles.embedHint}>
  If the page stays blank, this service may block embedding. Use Open in browser.
</div>
```

This hint renders **unconditionally** below every iframe. Screenshots (`48-service-light.png`) confirm it appears even when `example.com` loaded successfully. It reads as a permanent error message, making every service window look broken.

**Fix:** Only show the hint when embedding actually fails, detected via an `onLoad` timeout:
```tsx
const [failed, setFailed] = useState(false);
useEffect(() => {
  setFailed(false);
  const t = setTimeout(() => setFailed(true), 4000);
  return () => clearTimeout(t);
}, [reloadKey, url]);

return (
  // ...
  {failed && (
    <div className={styles.embedHint}>
      This service may block embedding. Use Open in browser.
    </div>
  )}
);
```

---

### V3. No loading state in the in-app browser (confirmed via screenshot)

**File:** `frontend/src/components/window/ServiceWindow.tsx:41-48`

The iframe has no `onLoad` handler, no spinner, and no skeleton. Screenshots confirm a blank white rectangle during load with no visual feedback. This is why the permanent embed hint exists (a crude workaround).

**Fix:** Add a loading overlay that hides on `onLoad`:
```tsx
const [loading, setLoading] = useState(true);
// reset on reload
useEffect(() => { setLoading(true); }, [reloadKey, url]);

return (
  // ...
  <div className={styles.frameWrapper}>
    {loading && <div className={styles.loadingOverlay}><Spinner /></div>}
    <iframe
      key={reloadKey}
      className={styles.frame}
      src={url}
      title={name}
      onLoad={() => setLoading(false)}
      sandbox="..."
      referrerPolicy="no-referrer-when-downgrade"
    />
  </div>
);
```

---

## 🟡 Medium Severity

### V4. Hardcoded `#fff` backgrounds and text (3 instances)

| File:line | Code | Issue |
|-----------|------|-------|
| `components/window/ServiceWindow.module.css:59` | `.frame { background: #fff; }` | Stark white iframe area in dark mode (confirmed in `49-service-dark.png`) |
| `components/window/WindowFrame.module.css:58` | `.closeBtn:hover { color: #fff; }` | Should use `--color-on-accent` |
| `components/overlay/ConflictDialog.module.css:139` | `color: var(--color-text-on-primary, #fff)` | Falls back to `#fff`; should use `--color-on-accent` (also see V1) |

**Fix:**
- `ServiceWindow.module.css:59` → `background: var(--color-surface);` (pre-load background; iframe content paints its own once loaded)
- `WindowFrame.module.css:58` → `color: var(--color-on-accent);`
- `ConflictDialog.module.css:139` → `color: var(--color-on-accent);` (after V1 fix)

---

### V5. Hardcoded `backdrop-filter` bypassing `--glass-backdrop` (25 instances)

The token `--glass-backdrop: blur(6px) saturate(110%)` exists but 25 declarations use raw values with no consistency:

| Blur value | Files |
|------------|-------|
| `blur(6px)` | LoginScreen |
| `blur(10px)` | ErrorBanner |
| `blur(12px) saturate(130%)` | FolderPicker, SettingsPanel (×5), Dialogs |
| `blur(14px) saturate(135%)` | LoginScreen (×2), Select, ConflictDialog, BatchRename, SettingsPanel, Dialogs |
| `blur(16px) saturate(140%)` | TopBarQuickActions |
| `blur(18px) saturate(140%)` | FolderPicker, AppPanel, Preview |
| `blur(20px) saturate(145%)` | Toast |
| `blur(22px) saturate(145%)` | ConflictDialog, Dialog |

**Impact:** Glass surfaces have visibly different blur intensities. The mobile `@media` override in `tokens.css` (which increases blur) is bypassed entirely for these components.

**Fix:** Use `var(--glass-backdrop)` everywhere. If a component genuinely needs stronger blur (e.g. modals vs controls), define a small set of tokens:
```css
--glass-backdrop-strong: blur(14px) saturate(135%);
--glass-backdrop-modal: blur(20px) saturate(145%);
```

---

### V6. Mixed `rem` vs `px` font-sizes (43 instances)

The token system defines all font-sizes in `px`. 15 declarations use `px` (consistent), 28 use `rem` (inconsistent), concentrated in:

| File | `rem` count | Example values |
|------|-------------|----------------|
| `components/overlay/ConflictDialog.module.css` | 10 | `1rem`, `0.85rem`, `0.78rem`, `0.75rem`, `0.72rem`, `0.7rem` |
| `pages/SearchResultsView.module.css` | 10 | `0.875rem`, `0.8rem`, `0.72rem` |
| `components/overlay/ContextMenu.module.css` | 1 | `0.8rem` |

**Impact:** `0.85rem` at default 16px root = 13.6px, matching no token (`--font-size-base` is 13px, `--font-size-md` is 14px). Creates sub-pixel sizes that render slightly differently across browsers.

**Fix:** Replace all `rem` font-sizes with the nearest `--font-size-*` token. If `rem` scaling is desired for accessibility, convert the token definitions themselves to `rem` and use tokens consistently.

---

### V7. Unicode glyphs for window controls instead of the icon system

**File:** `frontend/src/components/window/WindowFrame.tsx:236-239`

```tsx
<button aria-label="Minimize">─</button>
<button aria-label={isMaximized ? 'Restore' : 'Maximize'}>{isMaximized ? '❐' : '□'}</button>
<button aria-label="Close">✕</button>
```

The minimize/maximize/close buttons use raw Unicode characters instead of the Lucide `Icon` system used everywhere else. These render inconsistently across fonts/OSes — `❐` (restore) often renders as a missing-glyph box. Confirmed in `27-service-titlebar.png` close-up.

**Fix:**
```tsx
<button aria-label="Minimize"><Icon name="window-minimize" size={14} /></button>
<button aria-label={isMaximized ? 'Restore' : 'Maximize'}>
  <Icon name={isMaximized ? 'window-restore' : 'window-maximize'} size={14} />
</button>
<button aria-label="Close"><Icon name="window-close" size={14} /></button>
```

---

### V8. `transition: 100ms` bypasses token

**File:** `frontend/src/components/window/WindowFrame.module.css:53`

```css
.controlBtn { transition: background 100ms; }
```

Uses `100ms` instead of `var(--transition-fast)` (120ms). Every other transition uses the token or is within 10ms of it.

**Fix:** `transition: background var(--transition-fast);`

---

### V9. Service toolbar doesn't match glass title bar

**File:** `frontend/src/components/window/ServiceWindow.module.css:8-16`

The `WindowFrame` title bar uses `appSurfaceHeader` (glass background), but the `ServiceWindow` toolbar directly below it uses opaque `--color-surface-raised`. Screenshots show a visible seam between the two stacked headers.

**Fix:**
```css
.toolbar {
  background: var(--app-surface-header-bg);  /* was var(--color-surface-raised) */
}
```

---

### V10. Ad-hoc z-index scale with no token (25 values, 1 ordering conflict)

There is no z-index token system. 25 z-index values are scattered with an unclear hierarchy:

| z-index | Component | Layer |
|---------|-----------|-------|
| `-1` | LoginScreen background | Behind content |
| `0` | Home workspace | Base |
| `1` | Home overlays, FileItem drag | Raised |
| `10` | FileGridView, FileListView, WindowFrame resize | Content raised |
| `30` | FileSearchBar dropdown | Dropdown |
| `139` | FilesView, Home taskbar | Arbitrary |
| `200` | Home taskbar container | Arbitrary |
| `500` | shared.module.css overlay | Overlay base |
| `600` | Toast | Toast |
| `610` | ConflictDialog | Modal (above toast!) |
| `9995` | WindowFrame snap preview | High |
| `10000` | Dock, BreadcrumbBar, Taskbar, TopBar | Chrome |
| `10001` | ActivityPanel, AppMenuBar, TopBar dropdowns | Chrome dropdowns |
| `10002` | ContextMenu | Context menu |

**Issue:** ConflictDialog (610) is above Toast (600) — modals should typically be below toasts, since toasts are transient notifications that should appear above modal content. `139` and `200` are arbitrary magic numbers.

**Fix:** Define a z-index token scale:
```css
--z-base: 0;
--z-raised: 10;
--z-dropdown: 30;
--z-overlay: 500;
--z-modal: 600;
--z-toast: 700;
--z-chrome: 10000;
--z-chrome-dropdown: 10001;
--z-context-menu: 10002;
```
Then fix the ConflictDialog (610) / Toast (600) ordering so toasts sit above modals.

---

### V11. Hardcoded `rgba` box-shadows and legacy syntax

| File:line | Code | Token |
|-----------|------|-------|
| `ConflictDialog.module.css:6` | `box-shadow: 0 8px 32px rgba(0,0,0,0.25)` | Should use `--app-surface-shadow` (nearly identical) |
| `DesktopView.module.css:85` | `box-shadow: 0 1px 4px rgba(0,0,0,0.28)` | Should use `--shadow-card` / `--shadow-card-hover` |

Also: these use legacy comma syntax (`rgba(0,0,0,0.25)`) while the rest of the codebase uses modern space-separated syntax (`rgb(0 0 0 / 25%)`).

**Fix:** Replace with `var(--app-surface-shadow)` / `var(--shadow-card)` respectively, or convert to modern `rgb(R G B / A)` syntax if a custom shadow is genuinely needed.

---

### V12. Hardcoded transition durations (5 instances)

`--transition-fast` is `120ms ease` but 5 declarations use different durations:

| File:line | Duration | Context |
|-----------|----------|---------|
| `WindowFrame.module.css:53` | `100ms` | control button hover |
| `DiskUsageAnalyzer.module.css:132` | `150ms` | transform |
| `ProgressBar.module.css:14` | `300ms` | width animation |
| `DiskUsageAnalyzer.module.css:68,168` | `300ms` | width animation |

**Fix:** The 300ms width transitions are intentional (progress bars need slower easing) — define a `--transition-progress: 300ms ease` token. The 100ms/150ms values should snap to `--transition-fast`.

---

## 🟢 Low Severity

### V13. Hardcoded spacing matching token values (52 instances)

52 declarations use raw `px` for padding/margin/gap that exactly match a spacing token:

```css
gap: 8px;       /* → var(--space-sm) */
padding: 4px;   /* → var(--space-xs) */
margin: 2px;    /* → var(--space-xxs) */
gap: 12px;      /* → var(--space-md) */
gap: 16px;      /* → var(--space-lg) */
```

**Worst offenders:** `TopBar.module.css` (7), `BreadcrumbBar.module.css` (5), `ConflictDialog.module.css` (4).

**Impact:** No visual inconsistency today (values match), but future spacing-scale changes will be incomplete.

**Fix:** Sweep all hardcoded spacing values to their `--space-*` tokens. Mechanical find-and-replace.

---

### V14. Hardcoded border-radius matching tokens (11 instances)

| File:line | Value | Token |
|-----------|-------|-------|
| `TopBar.module.css:50,97,118` | `10px` | `--radius-md` |
| `TopBarQuickActions.module.css:16` | `10px` | `--radius-md` |
| `Taskbar.module.css:135` | `3px` | `--radius-xs` |
| `TopBar.module.css:205` | `8px` | no exact token |
| `TopBarQuickActions.module.css:6` | `12px` | no exact token |
| `TopBarSearch.module.css:5` | `8px` | no exact token |
| `Skeleton.module.css:31` | `4px` | no exact token |
| `Dialogs.module.css:192` | `4px` | no exact token |
| `Taskbar.module.css:59` | `2px` | smaller than `--radius-xs` |

**Note:** `8px`, `12px`, and `4px` don't have matching tokens — these reveal gaps in the radius scale.

**Fix:** Either add tokens for the missing values (`--radius-2xs: 4px`, `--radius-3xl` etc.) or snap to the nearest existing token. Then sweep all hardcoded radius values to tokens.

---

### V15. No favicon in the service window toolbar

**File:** `frontend/src/components/window/ServiceWindow.tsx:29`

The toolbar shows the service name and origin as text, but no icon — even though the desktop icon already fetched `svc.iconUrl`. Screenshots confirm a text-only toolbar. Every desktop OS window shows the app icon next to the title.

**Fix:** Pass `iconUrl` into the window state and render it in the ServiceWindow toolbar:
```tsx
<div className={styles.address}>
  {iconUrl && <IconImg src={iconUrl} alt="" width={20} height={20} />}
  <span className={styles.serviceName}>{name}</span>
  <span className={styles.origin}>{origin}</span>
</div>
```

---

### V16. `referrerPolicy` could be stricter

**File:** `frontend/src/components/window/ServiceWindow.tsx:47`

`no-referrer-when-downgrade` sends the full referrer to same-protocol destinations. For a sandboxed service embed, `strict-origin-when-cross-origin` (browser default since 2020) or `no-referrer` would be more privacy-conservative.

**Fix:** `referrerPolicy="strict-origin-when-cross-origin"` or `referrerPolicy="no-referrer"`.

---

### V17. Hardcoded font-sizes in window components

**File:** `ServiceWindow.module.css:27,35,66` and `WindowFrame.module.css:28,50,160`

```css
.serviceName { font-size: 13px; }    /* → var(--font-size-base) */
.origin { font-size: 12px; }         /* → var(--font-size-sm) */
.embedHint { font-size: 12px; }      /* → var(--font-size-sm) */
.titleText { font-size: 13px; }      /* → var(--font-size-base) */
.controlBtn { font-size: 13px; }     /* → var(--font-size-base) */
```

**Fix:** Replace with the matching `--font-size-*` tokens.

---

### V18. SearchResultsView uses `rem` throughout

**File:** `frontend/src/pages/SearchResultsView.module.css`

10 `rem` font-size declarations (`0.875rem`, `0.8rem`, `0.72rem`). Part of V6 but worth calling out separately as a concentrated file.

**Fix:** Convert to `--font-size-*` tokens (`0.875rem` → `--font-size-base`, `0.8rem` → `--font-size-sm`, `0.72rem` → `--font-size-xs`).

---

## ✅ What's visually consistent (confirmed via screenshots)

| Area | Status |
|------|--------|
| **Glass-morphism** | Consistent across top bar, dock, window frames in both themes |
| **Dark mode tokens** | Well-tuned — no contrast issues observed |
| **Color tokens** | Only 4 hardcoded hex colors outside `tokens.css`; rest use `var(--color-*)` |
| **Glass variables** | `--glass-bg`, `--glass-menu-bg`, `--glass-control-bg`, `--glass-border` used correctly |
| **Focus styles** | `button:focus-visible` and input focus use `--color-brand` consistently |
| **Scrollbar theming** | Single global rule, no per-component overrides |
| **Overlay backdrop** | `shared.module.css` `.overlay` uses `--color-overlay` + `--glass-backdrop` consistently |
| **Login screen** | Clean centered card, consistent in light + dark |
| **Desktop** | Icons render correctly, taskbar/dock consistent |
| **File browser** | Window chrome, breadcrumbs, toolbar all consistent |

---

## Recommended Fix Priority

### Immediate (live bugs)
1. **V1** — Fix broken `--color-primary` references in ConflictDialog (active buttons have no background)
2. **V2** — Make embed hint conditional on actual load failure
3. **V3** — Add loading state to the in-app browser

### High impact (visible inconsistency)
4. **V4** — Replace `#fff` with `var(--color-on-accent)` / `var(--color-surface)`
5. **V7** — Replace Unicode window controls with Lucide icons
6. **V9** — Fix service toolbar / title bar glass seam
7. **V10** — Define z-index token scale; fix ConflictDialog/Toast ordering

### Consistency sweep
8. **V5** — Standardize `backdrop-filter` to `var(--glass-backdrop)` (25 instances)
9. **V6** — Convert `rem` font-sizes to `--font-size-*` tokens (28 instances)
10. **V13** — Sweep hardcoded spacing to `--space-*` tokens (52 instances)
11. **V14** — Sweep hardcoded radius to `--radius-*` tokens; fill scale gaps

### Polish
12. **V8, V12** — Align transition durations to tokens
13. **V11** — Replace hardcoded shadows with tokens
14. **V15** — Add favicon to service window toolbar
15. **V16** — Tighten `referrerPolicy`
16. **V17, V18** — Convert remaining hardcoded font-sizes to tokens

---

## Reproducing the screenshots

The screenshots referenced in this audit were captured via Playwright headless browser:

```bash
# Prerequisites: dev server running (frontend :8342, backend :8090)
npx playwright install chromium
node scripts/visual-audit.mjs    # login, desktop, files
# Screenshots saved to /tmp/volum-screens/*.png
```

Captured views: `01-login-light`, `02-desktop-dark`, `27-service-titlebar`, `30-desktop-full`, `40-files-light`, `41-files-dark`, `42-settings-light`, `43-settings-dark`, `44-jobs-light`, `45-jobs-dark`, `46-trash-light`, `47-trash-dark`, `48-service-light`, `49-service-dark`, `51-service-embed-hint`.
