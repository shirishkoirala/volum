# Name Change Inventory: Volum → Volum Desktop

> **Completed** — all user-facing "Volum" text has been renamed to "Volum Desktop":
> - `frontend/index.html` title: `Volum Desktop`
> - `TopBar.tsx` brand name: `Volum Desktop`
> - `LoginScreen.tsx` heading: `Volum Desktop`
>
> Internal identifiers (localStorage keys, env vars, cookie names, module paths, package.json name) remain as `volum_*`/`volum-*` for backward compatibility and config compatibility.

## Scope

Only user-facing text is renamed. Internal identifiers (localStorage keys, env vars, cookie names, module paths, package.json name) stay as `volum_*`/`volum-*` for backward compatibility and config compatibility.

## Files Changed

### HTML Title
| File | Current | New |
|------|---------|-----|
| `frontend/index.html` line 11 | `<title>Volum</title>` | `<title>Volum Desktop</title>` |

### Brand in UI
| Location | Current | New |
|----------|---------|-----|
| TopBar brand name | `Volum` | `Volum Desktop` |
| LoginScreen heading | `Volum` | `Volum Desktop` |

### Document-Level Titles (Home.tsx document.title setters)
| Context | Current | New |
|---------|---------|-----|
| File view | `X — Volum` | `X — Volum Desktop` |
| Jobs view | `Jobs — Volum` | `Jobs — Volum Desktop` |
| Settings view | `Settings — Volum` | `Settings — Volum Desktop` |

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

All docs updated to use "Volum Desktop" for user-facing references.

## What NOT Changed

Anything that would break running instances or configuration:

- `localStorage` keys (e.g. `volum_sidebarCollapsed`, `volum_theme`)
- `sessionStorage` keys
- Environment variable names
- Cookie names
- API endpoint paths (`/api/...`)
- Module/package import paths
- CSS class names (hashed by CSS Modules)
- File/Directory names in the project
- Docker image names
- Database table names
- Internal Go module path (`github.com/volum-app/volum/backend`)

## Verification

- [x] App title bar shows "Volum Desktop"
- [x] TopBar brand shows "Volum Desktop"
- [x] Login screen heading shows "Volum Desktop"
- [x] Document tab title shows "X — Volum Desktop" in file views
- [x] Settings panel title shows "Settings — Volum Desktop"
- [x] Jobs panel title shows "Jobs — Volum Desktop"
- [x] localStorage keys still start with `volum_` for backward compatibility
