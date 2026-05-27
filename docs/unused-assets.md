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

## Definitely Never Used

These ~13,500+ icons are KDE Plasma system tray / status bar / app-specific icons completely irrelevant to Volum (a web-based file manager). They will never be used.

| Pattern | Description | Count |
|---------|-------------|------:|
| `*-symbolic.svg` throughout | KDE symbolic variant duplicates (~50% of all files) | 9,815 |
| `third-party app indicators` | Telegram, Transmission, Dropbox, VLC, KDE Connect, etc. | 1,556 |
| `network-mobile-*` | Cellular signal bars (0–100%, 3G/4G/LTE/5G, locked, etc.) | 530 |
| `call-*`, `mail-*` | Phone call and mail status indicators | 577 |
| `network-wireless-*` | WiFi signal bars (0–100%, limited, locked, connected, etc.) | 161 |
| `battery-*` | Battery level indicators (000–100%, charging/caution/missing) | 165 |
| `input-*` | Caps lock, num lock, keyboard, touchpad, combo key indicators | 154 |
| `weather-*`, `temperature-*`, `redshift-*`, `daytime-*`, `night-light-*` | Weather/temperature/day-night status icons | 176 |
| `fcitx-*`, `ime-*` | Chinese/Japanese/Korean input method editors | 229 |
| `media-playback-*`, `media-playlist-*` | Media player controls (play/pause/stop/shuffle/repeat) | 127 |
| `task-*`, `appointment-*` | KDE calendar and Todo task status icons | 97 |
| `emblems/` | KDE Dolphin file emblem icons (entire directory) | 177 |
| `state-*`, `data-*`, `radio-*`, `checkbox-*`, `rating-*`, `starred-*` | KDE form theme elements and state indicators | 128 |
| `user-*` (available/away/busy/idle/offline/online) | User presence status icons | 51 |
| `camera-*`, `mic-*`, `microphone-*` | Camera and microphone status (on/off/ready) | 99 |
| `audio-volume-*` | Volume level indicators (high/medium/low/muted/danger) | 43 |
| `rotation-*`, `orientation-*`, `flightmode-*`, `location-*` | Screen orientation, flight mode, location services | 42 |
| `network-wired-*` | Wired ethernet connection status | 36 |
| `notification-*`, `notifications-*` | Notification state icons (active/inactive/disabled) | 25 |
| `software-update-*`, `update-*` | Software update status (high/low/medium/none) | 26 |
| `security-*` (high/medium/low) | KDE firewall/security level indicators | 28 |
| `system-suspend-*`, `system-lock-*` | Suspend and screen lock status | 30 |
| `printer-*` | Printer status (error/printing/warning) | 13 |
| `display-brightness-*`, `keyboard-brightness-*`, `keyboard-layout-*` | Brightness and layout indicators | 3 |
| `video-card-*`, `video-off-*` | Video card and video mute indicators | 11 |
| `script-error-*` | Script error status | 2 |
| `network-cellular-*` | Cellular network type indicators (3G/4G/5G/EDGE) | 16 |
| `network-bluetooth-*` | Bluetooth status (active/inactive/locked) | 17 |
| `network-vpn-*` | VPN connection status | 5 |
| `network-flightmode-*` | Airplane mode toggles | 10 |
| **Total** | | **~13,500+** |

Many icons appear in multiple sizes (16px, 22px, 24px, 32px, 48px, 64px) plus symbolic/non-symbolic variants, so individual `*.svg` file counts are inflated by duplication. The actual unique icon concepts is ~2,000.

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
