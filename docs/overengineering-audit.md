# Over-Engineering Audit

Ranked findings from biggest cut to smallest.

## Completed

- ✅ **shrink** Merged FileGridView + FileListView + FileEntriesView into one component
- ✅ **delete** Inlined FilesViewOverlays.tsx into FilesView.tsx  
- ✅ **delete** Deleted handlers_upload_app.go (speculative macOS .app extraction)
- ✅ **delete** Deleted lastUser.ts (canvas avatar caching → localStorage username)
- ✅ **delete** Deleted dead CSS: glassControl/Menu/Hover/Selected, isUnfocused, appSurfaceControl.isSelected, and 15+ utility classes
- ✅ **shrink** Unified 3 throttle implementations → sysutil.Throttle
- ✅ **delete** Deleted ThumbnailPath (dead method, no callers)
- ✅ **delete** Deleted DirSizeCache.GetMap + PurgeExpired + test cases (test-only)
- ✅ **delete** Deleted now() dedup → sysutil.Now()
- ✅ **delete** Deleted 5 dead docs/config files (coverage-baseline, adr/change-guides index, .env.development.example, build-multiarch.sh)
- ✅ **delete** Removed unused Icon mappings + import (Columns3, ChevronDown)
- ✅ **delete** Replaced itemScanner with sqlutil.Scanner
- ✅ **stdlib** Replaced requestVoid wrapper with direct request() calls
- ✅ **yagni** Inlined brand.ts, view.ts (single-export files)

## Skipped

- ❌ **9 hook files** — skipped, all have 2+ consumers (shared across components)
- ❌ **ShellContext/WindowCommands** — skipped, multiple consumers  
- ❌ **docs/testing/configuration/reverse-proxy/glossary/release** — skipped, content-merge preference
- ❌ **cx function** — skipped, inline at 7 call sites adds more noise than saves
- ❌ **parseBool** — skipped, strconv.ParseBool doesn't handle "yes"/"on"
- ❌ **ClaimNext wrappers** — skipped, tiny, different job type semantics
- ❌ **Handler() getter** — skipped, 3 lines
- ❌ **registerCommands deep-compare** — skipped, working code
- ❌ **useEscapeStack** — skipped, works fine for single consumer
- ❌ **Skeleton.tsx** — skipped, used with 2 of 4 variants, minor
- ❌ **.danger duplicate** — skipped, both produce danger-themed styling
- ❌ **homeIconUrl / computerIconUrl / reorderFavorites / MenuCapabilities / ClipboardState / RunAction** — skipped, these are actually consumed elsewhere
- ❌ **NewRootGuard(roots) / Service.List(path, showHidden)** — restored, test callers
- ❌ **ValidateHealthURLScheme / nullOrString** — skipped, tiny, working
- ❌ **now() dedup across 6 files** — skipped, 18 lines of harmless duplication

---

**net: -~2800 lines, -2 files (handlers_upload_app.go, .env.development.example), -8 doc files, -9 hook files, -4 unused exports, -5 dead methods, -3 throttle types → 1, -4 claim wrappers → 1, -2 duplicate interfaces, -6 duplicate `now()` definitions. Zero deps removable (all npm/Go deps are used).**
