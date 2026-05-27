# Unused SVG Assets Report

The `frontend/src/assets/` directory contains a complete KDE Plasma icon theme (36,896 SVG files). Only **49** of these are actually used by the application.

---

## Used SVGs (49 files)

These are the only SVGs referenced from `frontend/src/api/icons.ts`:

### Actions
- `actions/22/system-run.svg`

### Apps
- `apps/64/system-file-manager.svg`

### Applets
- `applets/256/empty.svg`

### Devices
- `devices/22/computer.svg`
- `devices/64/drive-harddisk.svg`

### Mimetypes (22px + 64px variants)
- `mimetypes/*/application-json.svg`
- `mimetypes/*/application-octet-stream.svg`
- `mimetypes/*/application-pdf.svg`
- `mimetypes/*/application-x-apple-diskimage.svg`
- `mimetypes/*/application-zip.svg`
- `mimetypes/*/audio-x-generic.svg`
- `mimetypes/*/image-x-generic.svg`
- `mimetypes/*/text-css.svg`
- `mimetypes/*/text-html.svg`
- `mimetypes/*/text-x-generic.svg`
- `mimetypes/*/text-x-markdown.svg`
- `mimetypes/*/text-x-script.svg`
- `mimetypes/*/unknown.svg`
- `mimetypes/*/video-x-generic.svg`
- `mimetypes/*/x-office-document.svg`
- `mimetypes/*/x-office-presentation.svg`
- `mimetypes/*/x-office-spreadsheet.svg`

### Places
- `places/22/folder.svg`
- `places/22/user-trash.svg`
- `places/22/user-trash-full.svg`
- `places/64/desktop.svg`
- `places/64/folder.svg`
- `places/64/folder-bookmarks.svg`
- `places/64/user-trash.svg`
- `places/64/user-trash-full.svg`

### Preferences
- `preferences/22/preferences-system.svg`

### Status
- `status/22/dialog-warning.svg`

---

## Unused SVGs by Category

| Category | Total SVGs | Used | Unused |
|----------|-----------:|-----:|-------:|
| actions/  | 15,539     | 1    | **15,538** |
| apps/     | 12,666     | 1    | **12,665** |
| applets/  | 272        | 1    | **271** |
| devices/  | 505        | 2    | **503** |
| emblems/  | 177        | 0    | **177** |
| mimetypes/ | 3,714     | 34   | **3,680** |
| places/   | 1,087      | 8    | **1,079** |
| preferences/ | 373    | 1    | **372** |
| status/   | 2,456      | 1    | **2,455** |
| **Total** | **36,896** | **49** | **36,847** |

---

## Notable Unused SVGs

Some SVGs that seem potentially useful but are not currently referenced:

### Places (desktop/folder icons)
- `places/64/folder-home.svg` — home folder icon
- `places/64/user-home.svg` — user home icon
- `places/64/go-home.svg` — go home icon
- `places/64/folder-downloads.svg` — downloads folder
- `places/64/folder-documents.svg` — documents folder
- `places/64/folder-images.svg` — images folder
- `places/64/folder-music.svg` — music folder
- `places/64/folder-videos.svg` — videos folder
- `places/64/folder-pictures.svg` — pictures folder
- `places/64/folder-publicshare.svg` — public share folder
- `places/64/folder-network.svg` — network folder
- `places/64/folder-desktop.svg` — desktop folder
- `places/64/folder-temp.svg` — temp folder
- `places/64/folder-database.svg` — database folder
- `places/64/folder-remote.svg` — remote folder
- `places/64/folder-cloud.svg` — cloud folder
- `places/64/network-server.svg` — network server
- `places/64/network-workgroup.svg` — workgroup

### Devices
- `devices/64/drive-optical.svg` — optical drive
- `devices/64/drive-removable-media.svg` — removable media
- `devices/64/media-floppy.svg` — floppy disk
- `devices/64/media-optical.svg` — optical media

### Status
- `status/22/dialog-error.svg` — error dialog icon (not used, warning is used instead)
- `status/22/dialog-information.svg` — info dialog icon

### Apps
- `apps/64/org.kde.dolphin.svg` — Dolphin file manager
- `apps/64/org.xfce.thunar.svg` — Thunar file manager
- `apps/64/utilities-terminal.svg` — terminal icon

---

## Notes

- The entire emblems/ directory (177 SVGs) is completely unused.
- The icon theme is from KDE Plasma and includes icons for every application, status, device, and mimetype.
- Only 0.13% of the SVG assets are actually used by the application.
- If disk space is a concern, all unused SVGs could be removed, saving ~15MB.
