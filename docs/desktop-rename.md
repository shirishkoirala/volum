# Name Change Inventory: Volum → Volum Desktop

## Scope

Only user-facing text is renamed. Internal identifiers (localStorage keys, env vars, cookie names, module paths, package.json name) stay as `volum_*`/`volum-*` for backward compatibility and config compatibility.

## Files to Change

### HTML Title
| File | Current | New |
|------|---------|-----|
| `frontend/index.html` line 11 | `<title>Volum</title>` | `<title>Volum Desktop</title>` |

### Brand in UI (App.tsx)
| Location | Current | New |
|----------|---------|-----|
| Brand header (sidebar, ~line 734) | `Volum` text | `Volum Desktop` (brand icon stays) |
| Desktop "This PC" heading | `Volum` (implicit via page title context) | `Volum Desktop` (explicit heading) |

### Brand in TopBar
| Location | Current | New |
|----------|---------|-----|
| `.brandName` in new TopBar component | `Volum` | `Volum Desktop` |

### Document-Level Titles

In `App.tsx`, the `document.title` setter (around line 620):
```typescript
document.title = currentPath ? `${path.basename(currentPath)} — Volum` : 'Volum';
```
becomes:
```typescript
document.title = currentPath ? `${path.basename(currentPath)} — Volum Desktop` : 'Volum Desktop';
```

In the Jobs view (around line 1295):
```typescript
document.title = 'Jobs — Volum';
```
becomes:
```typescript
document.title = 'Jobs — Volum Desktop';
```

In the Settings panel:
```typescript
document.title = 'Settings — Volum';
```
becomes:
```typescript
document.title = 'Settings — Volum Desktop';
```

### README.md Title

| File | Current | New |
|------|---------|-----|
| `README.md` | `# Volum` | `# Volum Desktop` |

### AGENTS.md

| File | Current | New |
|------|---------|-----|
| `AGENTS.md` | `# Volum — Agent Memory` | `# Volum Desktop — Agent Memory` |
| Multiple references | references to "Volum" project | "Volum Desktop" |

### docs/*.md Files

Check all existing docs for user-facing mentions:
- `docs/roadmap.md` — any user-facing titles
- `docs/volum-desktop-plan.md` (this file) — keep as is (it's the plan)
- All new `desktop-*.md` docs — already use "Volum Desktop"

### Package Name (NOT changing)

| File | Value | Decision |
|------|-------|----------|
| `frontend/package.json` `name` | `"volum"` | **Keep** |
| `backend/go.mod` | `module volum` | **Keep** |
| `Dockerfile` / compose files | volum references | **Keep** |

## What NOT to Change

Anything that would break running instances or configuration:

- `localStorage` keys (e.g. `volum_sidebarCollapsed`, `volum_theme`)
- `sessionStorage` keys
- Environment variable names (except display/help text)
- Cookie names
- API endpoint paths (`/api/...`)
- Module/package import paths
- CSS class names (they're hashed by CSS Modules anyway)
- File/Directory names in the project (e.g., `frontend/`, `backend/`)
- Docker image names
- Database table names

## Rename Implementation

```bash
# List of files to update:
# frontend/index.html
# frontend/src/App.tsx (document.title setters)
# frontend/src/components/TopBar.tsx (brand name)
# README.md
# AGENTS.md

# In each file, replace user-facing "Volum" with "Volum Desktop"
# Use care: only replace "Volum" when it's used as the product name
# Do NOT replace "volum" in:
#   - localStorage keys
#   - imports (import volum from ...)
#   - API paths
#   - env vars
#   - package names
```

## Verification

After rename:
1. Open the app → title bar shows "Volum Desktop"
2. Top Bar brand shows "Volum Desktop"
3. Desktop view heading shows "Volum Desktop" (if added)
4. Document tab title shows "X — Volum Desktop" in file views
5. Settings panel title shows "Settings — Volum Desktop"
6. Jobs panel title shows "Jobs — Volum Desktop"
7. localStorage keys (check DevTools → Application → Local Storage) still start with `volum_`

## Pre-Existing Renames Already Done

| Item | Location | Status |
|------|----------|--------|
| Sidebar "Storage" → "Removable" | App.tsx sidebar | Done (Batch 2) |
| Desktop "This PC" as brand context | App.tsx desktop | Already "Volum" implicitly |
