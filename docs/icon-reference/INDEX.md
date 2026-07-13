# Icon Reference Index

Use this catalogue before adding or drawing a new icon. Search by semantic name, inspect the largest available SVG, then copy the chosen asset into `frontend/src/assets/` with a product-specific filename.

## Quick Search

```sh
# Search filenames by concept
rg --files icon-reference | rg -i 'disk|storage|chart'

# List a category and size
rg --files icon-reference/apps/48

# Find alternate sizes for one icon
rg --files icon-reference | rg '/(baobab|filelight)\.svg$'
```

Prefer this filename search over maintaining a generated list of all 6,000+ paths. The directory tree is the complete index; this file supplies the semantic map.

## Categories

| Folder | SVGs | Use for |
| --- | ---: | --- |
| `actions/` | 7 | Generic commands and navigation |
| `apps/` | 4,887 | Desktop applications and service shortcuts |
| `categories/` | 52 | Application groups and settings sections |
| `devices/` | 109 | Drives, removable media, scanners, hardware |
| `emblems/` | 125 | Small badges and state overlays |
| `mimetypes/` | 704 | File and document types |
| `places/` | 211 | Folders, bookmarks, home, network locations |
| `preferences/` | 158 | Settings pages and configuration tools |

## Size Selection

- Desktop/app icons: start with `apps/48`, `apps/64`, or `devices/64`.
- File grid icons: use `mimetypes/64`.
- File list and compact controls: use `mimetypes/32` or the shared Lucide action icons.
- Badges: use `emblems/16`, `emblems/22`, or `emblems/24`.
- Do not use symbolic icons for desktop shortcuts unless every sibling icon is symbolic.

## Canonical Product Choices

| Volum concept | Preferred reference | Search terms | Notes |
| --- | --- | --- | --- |
| Storage Analyzer | `apps/48/baobab.svg` | `baobab`, `filelight`, `disk usage` | Purpose-built disk-usage analyzer; distinct from Drives |
| Drives | `devices/64/drive-multidisk.svg` | `drive`, `multidisk` | Multiple local devices |
| Files | `apps/64/system-file-manager.svg` or nearest available size | `file manager`, `dolphin`, `thunar` | Desktop application icon |
| Trash | `places/64/user-trash.svg` / `user-trash-full.svg` | `trash` | Preserve empty/full states |
| Settings | `apps/32/preferences-system.svg` | `preferences`, `settings` | Existing Volum convention |
| Folder shortcut | `places/64/folder-bookmarks.svg` | `folder`, `bookmark` | Desktop favorite |
| Search | shared action icon `edit-find` | `search`, `find` | Use Lucide action map inside buttons |
| Refresh/loading | shared action icon `view-refresh` | `refresh` | Add the shared spin class when indicating progress |
| Duplicate files | `apps/48/com.github.artemanufrij.findfileconflicts.svg` or `preferences/32/window-duplicate.svg` | `duplicate`, `conflict` | Use only when Duplicate Finder needs its own icon |

## Storage and Analysis Candidates

| Reference | Meaning | Recommendation |
| --- | --- | --- |
| `apps/48/baobab.svg` | Disk usage analyzer | Preferred |
| `apps/48/org.kde.filelight.svg` | Alias of `baobab.svg` in this pack | Do not duplicate |
| `apps/48/filelight.svg` | Alternate disk usage analyzer | Secondary option |
| `apps/48/disk-utility.svg` | General disk utility | Too similar to Drives |
| `apps/48/disks.svg` | Disk management | Use for partition/device administration |
| `apps/48/disk-check.svg` | Disk verification | Use for filesystem health checks |
| `apps/48/kdiskmark.svg` | Disk benchmark | Use for performance testing |
| `places/64/folder-chart.svg` | Folder analytics | Good for folder-only reports |

## Selection Rules

1. Match meaning before color.
2. Keep desktop icons within the same illustrated asset family.
3. Keep toolbar and button icons in the shared `Icon` action map.
4. Reuse an existing Volum asset before importing another copy.
5. Copy only the chosen asset into the frontend bundle; never ship `icon-reference/`.
6. Record new canonical choices in this index.

