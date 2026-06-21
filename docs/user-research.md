# User Research: What People Want From Self-Hosted File Managers

Research gathered from GitHub issues, discussions, Reddit (r/selfhosted), Hacker News, and feature requests across the major open-source file manager projects (FileBrowser 35k★, Spacedrive 38k★, Files 44k★, Homarr, FileRise, Cloud Commander, Filestash, and others).

## Top Feature Desires

### 1. Multi-Device & Cloud Aggregation

Browse local disks, NAS, external drives, S3, Google Drive, Dropbox, OneDrive, and SFTP mounts from a single interface. Spacedrive's core pitch — "one explorer for all your files" — is consistently the most upvoted concept.

Users want to stop jumping between Finder, Drive web UI, and NAS admin panels.

**References:**
- [Spacedrive: unify files across devices and clouds](https://github.com/spacedriveapp/spacedrive)
- [FileBrowser: mounting multiple directories](https://github.com/filebrowser/filebrowser/issues/1467)
- [r/selfhosted: "one interface for everything"](https://www.reddit.com/r/selfhosted/comments/ueahgi/)

### 2. Tags, Metadata & Smart Organization

Hierarchical tags, AI auto-labeling, smart folders, and rich metadata as a first-class organizational layer alongside the filesystem tree. Users consistently outgrow pure folder hierarchies.

**References:**
- [HN: universal tag trees with parent/child relationships](https://news.ycombinator.com/item?id=31186313)
- [TagSpaces: tag-based file organization](https://www.tagspaces.org/)
- [Spacedrive: AI labeling with on-device models](https://spacedrive.com/blog/alpha-zero-two-release)

### 3. Fast, Global Search

Full-text content search, metadata filtering, fuzzy matching, and the ability to search across all mounted sources at once. Users expect Ctrl+K / Cmd+K instant search.

**References:**
- [Files: global search improvements](https://github.com/files-community/Files)
- [Homarr: built-in search across integrations](https://homarr.dev/)
- [FileBrowser: search within large directories](https://github.com/filebrowser/filebrowser/issues/1566)

### 4. Rich File Previews

Inline preview for PDFs, Office documents, images, video, audio, and code — without downloading. Users want to view, not just manage.

**References:**
- [FileVista: 70+ format document viewer](https://www.gleamtech.com/filevista)
- [r/selfhosted: preview-second vs preview-first UX](https://dev.to/johnson998877/)

### 5. Secure Share Links

Expiring links, password-protected shares, upload-only links for external contributors, download counters, and direct-download URLs.

**References:**
- [FileBrowser: share link enhancements](https://github.com/filebrowser/filebrowser/issues/1692)
- [FileRise: password-protected folder sharing](https://filerise.net/)
- [FileRun: secure file sharing with access control](https://filerun.com/)

### 6. Good Mobile Experience

Preview-first design, large touch targets, PWA support, responsive layout — not just a desktop UI squeezed onto a phone.

**References:**
- [Mobile alternatives comparison](https://dev.to/johnson998877/filebrowser-alternatives-for-mobile-a-self-hosters-comparison-guide-5ccm)
- [Filestash: PWA with preview-first mobile UX](https://www.filestash.app/)

### 7. Large-Folder Performance

Handle 10,000+ files without choking. Server-side pagination, virtualization, lazy loading, and size-gated previews.

**References:**
- [FileBrowser: stuck loading with 10K+ files](https://github.com/filebrowser/filebrowser/issues/1566)
- [FileBrowser: ~4000 files performance](https://github.com/filebrowser/filebrowser/issues/1689)
- [FileBrowser: GIF folders loading slowly](https://github.com/filebrowser/filebrowser/issues/3293)

### 8. Resumable & Reliable Uploads

Chunked uploads (TUS protocol), survive connection drops, handle special characters in filenames, large file support.

**References:**
- [FileBrowser: folder upload double slash path bug](https://github.com/filebrowser/filebrowser/issues/5845)
- [FileBrowser: large upload failures](https://github.com/filebrowser/filebrowser/issues/2931)
- [FileBrowser: Chrome crash with many small uploads](https://github.com/filebrowser/filebrowser/issues/3582)

### 9. Protocol Access (WebDAV, SMB, SFTP)

Users want to mount their file manager storage as a network drive in Finder, Explorer, or via CLI — not be locked into the web UI.

**References:**
- [FileRun: WebDAV support](https://filerun.com/)
- [Filestash: multi-backend protocol support](https://www.filestash.app/)
- [r/selfhosted: "must support standard protocols"](https://www.reddit.com/r/selfhosted/comments/17si22x/)

### 10. Service Health Dashboard

Status dots (green/orange/red), disk usage widgets, quick-launch tiles, service monitoring — the Homarr crossover that dashboard users love but file managers lack.

**References:**
- [Homarr: built-in status system](https://homarr.dev/)
- [Homepage: service health/API behaviour](https://github.com/gethomepage/homepage/issues/1142)

### 11. Dual-Pane & Tabbed Browsing

Side-by-side panels, tabbed folders, split views. Power users migrating from Total Commander, Double Commander, or Far Manager expect this.

**References:**
- [Double Commander: dual-panel inspiration](https://double-commander.com/)
- [Sigma File Manager: workspaces + tabs](https://alternativeto.net/software/sigma-file-manager/)
- [Tablacus Explorer: tabbed + add-on support](https://alternativeto.net/software/tablacus-explorer/)

### 12. Batch Operations

Multi-select for bulk rename, move, copy, delete, archive, extract, permissions change. Essential for managing large libraries.

**References:**
- [FileBrowser: batch operations](https://github.com/filebrowser/filebrowser/)
- [FileRise: batch operations](https://filerise.net/)

### 13. User Management & Permissions

Multi-user with per-user directories, granular ACLs, read-only roles, admin/user separation. Important for family/household and small-team deployments.

**References:**
- [FileBrowser: user management](https://filebrowser.org/)
- [FileRise: strong ACLs](https://filerise.net/)

### 14. Privacy & No Vendor Lock-In

No telemetry, no required cloud accounts, local-first data, open-source, easy migration off. This is the entire premise of self-hosting.

**References:**
- [Spacedrive: local-first, no cloud required](https://spacedrive.com/)
- [FileBrowser: single binary, no dependencies](https://filebrowser.org/)
- [FileRun: "no import, no migration, manage files where they are"](https://filerun.com/)

### 15. Customization

Themes, wallpaper, custom icons, configurable layouts, bookmark bars, keyboard shortcuts. Users want it to feel like *their* tool.

**References:**
- [Files: customizable appearance](https://files.community/)
- [Sigma File Manager: customizable features](https://alternativeto.net/software/sigma-file-manager/)
- [SourceForge: "customizable UI" as top trend](https://sourceforge.net/directory/file-managers/)

### 16. File Versioning & Trash

Recycle bin with restore, file version history, soft delete before hard delete, undelete from trash.

**References:**
- [Files: recycle bin integration](https://github.com/files-community/Files)
- [Nextcloud: file versioning](https://nextcloud.com/)

### 17. Conflict Handling

Smart conflict resolution: skip identical (size + checksum), auto-rename, overwrite with confirmation, apply-to-all options.

**References:**
- [FileBrowser: option to skip duplicates when moving](https://github.com/filebrowser/filebrowser/issues/3655)

### 18. AI Features

On-device content tagging, semantic search, smart suggestions, duplicate detection. Growing interest as local models improve.

**References:**
- [Spacedrive: AI-ready by design](https://spacedrive.com/)
- [TagSpaces: AI-powered tagging](https://www.tagspaces.org/)

### 19. Offline Access

Sync folders for offline use, mobile offline browsing, local cache of recently accessed files.

**References:**
- [Nextcloud: desktop sync clients](https://nextcloud.com/)
- [FileRun: desktop and mobile apps](https://filerun.com/)

### 20. Lightweight & Fast

Minimal resource usage, fast startup, no bloat. The most common complaint about Nextcloud is its weight.

**References:**
- [FileBrowser: 64MB RAM requirement](https://filebrowser.org/)
- [r/selfhosted: "lightweight" is a top criterion](https://www.reddit.com/r/selfhosted/comments/17si22x/)
- [Gossa: "light and simple webserver for your files"](https://github.com/pldubouilh/gossa)

## Common Pain Points With Existing Tools

| Tool | Pain Points |
|------|------------|
| **Nextcloud** | Bloated, slow, complex setup, heavy maintenance, too many features |
| **FileBrowser** | Maintenance-only mode, no new features, stale codebase, limited mobile UX |
| **Spacedrive** | Still alpha/unstable, v1 rewritten as v2, slow progress, requires daemon |
| **Homarr** | Dashboard only — no actual file operations |
| **Filestash** | Read-only oriented, limited write operations |
| **OwnCloud** | Slower than alternatives, fewer integrations |

## Volum's Position

Volum sits in a unique gap: a **capable file manager** that is also a **service hub**. The most commonly requested features that Volum already addresses:

- ✅ Multi-user with admin/readonly roles
- ✅ Secure share links with expiry
- ✅ Trash with restore
- ✅ Conflict handling (skip, overwrite, rename, skip_identical)
- ✅ Batch operations (move, copy, archive, extract, checksum)
- ✅ File previews (text, image, PDF, video, audio)
- ✅ Large-folder performance (paginated loading)
- ✅ Search with result actions
- ✅ Service health indicators
- ✅ Desktop wallpaper / customization
- ✅ Privacy (no telemetry, self-hosted)

**Biggest remaining gaps** compared to user expectations:

| Gap | Notes |
|-----|-------|
| Mobile experience | Needs PWA improvements, touch-first layout |
| WebDAV/SMB protocol support | Users want to mount storage in Finder/Explorer |
| Tags & metadata | No tagging system yet — folders only |
| Multi-cloud aggregation | Spacedrive's niche — lower priority for Volum |
| AI features | Low priority until local models are more accessible |
| File versioning | Trash exists, but no version history |
| Native apps | Deferred — PWA is the near-term path |
| In-browser terminal | Cloud Commander & KodExplorer show demand; xterm.js + Go PTY is well-understood |
| Disk space analyzer (treemap) | WinDirStat-class tooling — natural fit for a file manager desktop view |
| Duplicate file finder | Recurring r/selfhosted pain point; Volum's job engine + existing hashFile() make this feasible |

## 21. In-Browser Terminal

Users of web-based file managers frequently request a built-in terminal emulator so they can run shell commands without leaving the browser or opening a separate SSH session.

### What users want:

- **xterm.js-based web terminal** embedded directly in the file manager UI (same pattern as VS Code's integrated terminal)
- **Full shell access** — bash, zsh, or the server's default shell, not just a restricted command picker
- **WebSocket-backed PTY** — real-time interactive I/O via `node-pty`, `ttyd`, or Go equivalents
- **SSH into other hosts** from the terminal (not just the local server shell)
- **Resize, themes, copy/paste, search** — standard terminal emulator features
- **Security boundary** — auth-gated, optional read-only mode, command allowlisting option

### Existing implementations:

- **Cloud Commander** (Node.js, 2k★) — dual-panel file manager with a built-in terminal tab; the most popular web file manager with terminal support
- **ttyd** (C, 8k★) — standalone tool that wraps any CLI program in a web page via xterm.js + WebSocket; often used alongside file managers
- **GoTTY** (Go, 6k★) — same concept as ttyd but in Go
- **KodExplorer/kodbox** (PHP, 6.4k★) — web file manager + IDE with built-in terminal emulator
- **FileBrowser** — has a command runner (executes pre-defined shell commands on file events), but no interactive terminal. This is a frequently requested gap
- **WebShell** (Go) — RESTful command execution + web SSH terminal in one binary
- **Browsix** (research) — runs unmodified Unix programs in the browser tab via Web Workers

### Why Volum might want it:

- **Completes the server management use case** — file manager + terminal = users don't need to keep a separate SSH window open
- **Differentiator** — among lightweight web file managers (FileBrowser, FileGator), none have a built-in interactive terminal
- **Well-known building blocks** — `xterm.js` (frontend) + Go PTY library = straightforward integration, already demonstrated by GoTTY/WebShell

### References:

- [Cloud Commander: built-in terminal](https://github.com/coderaiser/cloudcmd)
- [ttyd: share terminal over web](https://github.com/tsl0922/ttyd)
- [GoTTY: Go web terminal](https://github.com/yudai/gotty)
- [xterm.js: browser terminal emulator](https://github.com/xtermjs/xterm.js)
- [KodExplorer: file manager + terminal](https://github.com/kalcaddle/KodExplorer)
- [WebShell: Go web terminal](https://github.com/adaptive-scale/webshell)
- [Browsix: Unix in browser](https://browsix.org/)

## 22. Disk Space Analyzer (Treemap Visualization)

WinDirStat (3.4k★), WizTree, Baobab, and GrandPerspective are among the most downloaded disk tools — users deeply want visual storage insight built into their file manager.

### What users want:

- **Treemap visualization** — colored rectangles sized proportionally to file/folder size, making space hogs immediately visible at a glance
- **Directory tree sorted by size** — classic "largest at top" view alongside the treemap
- **Drill-down interactivity** — click a rectangle to zoom into that folder; breadcrumb nav for zoom history
- **File type color coding** — extensions/categories get consistent colors so you can see "oh, most of this is video files" at a glance
- **Scan local and mounted paths** — analyze any root or folder accessible to the server
- **Delete/cleanup actions** — delete or move files directly from the treemap view (with confirmation)
- **Scan caching** — cache results so re-scanning the same folder is instant

### Existing implementations:

- **WinDirStat** (C++, 3.4k★) — the original Windows treemap disk analyzer; also has duplicate finder, largest files view, extension list
- **WizTree** (proprietary/free) — fastest Windows analyzer because it reads the MFT directly
- **Baobab** (GNOME Disk Usage Analyzer) — Linux treemap tool, part of GNOME
- **GrandPerspective** (macOS) — treemap for macOS
- **Filelight** (KDE) — circular/radial disk usage visualization
- **QDirStat** (C++, 2.5k★) — Linux Qt-based, WinDirStat successor
- **FileRise Pro** — recently added "storage explorer" with ncdu-style top-folders-by-size view + largest files + cleanup actions

### Why Volum might want it:

- **Natural extension of a file manager** — you browse files, you want to know what's eating space
- **High user demand** — WinDirStat/WizTree are perennially among the most-downloaded OSS utilities
- **Can be a desktop-view widget** — fits Volum's desktop metaphor nicely (e.g., "Disk Usage" as a desktop icon that opens a treemap)
- **Backend already has filesystem access** — scanning directory sizes is a recursive stat walk; Volum already does this for file listing

### References:

- [WinDirStat: treemap disk analyzer](https://windirstat.net/)
- [WizTree: fastest Windows analyzer](https://diskanalyzer.com/)
- [GNOME Baobab](https://wiki.gnome.org/Apps/DiskUsageAnalyzer)
- [GrandPerspective (macOS)](https://grandperspectiv.sourceforge.net/)
- [Filelight (KDE)](https://github.com/KDE/filelight)
- [QDirStat](https://github.com/shundhammer/qdirstat)
- [FileRise Pro storage explorer](https://filerise.net/)
- [Microsoft PowerToys feature request for disk analyzer](https://github.com/microsoft/PowerToys/issues/47594)
- [DiskPilot: modern OSS treemap tool](https://github.com/mhkasif/DiskPilot)

## 23. Duplicate File Finder

Duplicate files are a universal pain point — backup copies, multiple downloads, photo imports, scattered identical files across NAS shares. Users want deduplication built into the file manager, not as a separate CLI tool.

### What users want:

- **Content-based hashing** (SHA-256 or xxHash) — not just filename comparison; detect byte-identical files regardless of name
- **Multi-stage scanning** — first pass by file size (fast filter), second pass by partial hash (first/last N KB), third pass by full hash (expensive, only for candidates)
- **Source-of-truth folders** — designate one folder as authoritative; duplicates found elsewhere are candidates for removal
- **Preview before delete** — see duplicate groups, pick which copy to keep, with file metadata (path, date, size)
- **Dry-run mode** — show what would be deleted without actually removing anything
- **Hardlink/symlink dedup option** — instead of deleting, replace duplicates with hardlinks to a single copy (saves space while keeping all paths valid)
- **Cross-location scanning** — scan across multiple mounted roots, NAS folders, or cloud mounts at once
- **Photo/music-specific modes** — fuzzy matching for near-identical images (perceptual hashing) and audio files (tags + duration + fingerprint)

### Existing implementations:

- **fclones** (Rust, 2.8k★) — fastest CLI duplicate finder; multi-stage hashing, parallel scanning, HDD-aware IO ordering
- **dupeGuru** (Python, multi-platform GUI) — content + fuzzy filename matching; specialized Music/Picture modes
- **WinDirStat** — includes a duplicate files view alongside its treemap
- **rdfind** (C, CLI) — finds duplicates by size + partial + full hash; action modes: dry-run, delete, symlink, hardlink
- **fdupes** (C, CLI) — the classic Linux duplicate finder
- **czkawka** (Rust, 22k★) — modern multi-functional duplicate finder: files, photos, music, videos, empty folders, temporary files, broken files, big files
- **File Hunter** (Python, self-hosted web) — offline cataloging + duplicate detection + consolidation + storage treemap; closest existing project to what Volum might build

### Why Volum might want it:

- **High pain point** — "I have duplicates scattered across my NAS" is a recurring r/selfhosted thread topic
- **Natural job for Volum's job engine** — scanning for duplicates is a background task that reports progress, fits the existing worker model perfectly
- **Already has SHA-256 hashing** — `hashFile()` exists in `worker/checksum.go` for conflict handling; reuse for duplicate scanning
- **Multi-root support** — Volum already manages multiple storage roots; scanning all of them for cross-location duplicates is a differentiated feature
- **Can be additive** — doesn't need to be a built-in finder at first; a simple background job ("Find duplicates under /mnt/media") would already deliver value

### References:

- [fclones: efficient duplicate finder (Rust)](https://github.com/pkolaczk/fclones)
- [dupeGuru: cross-platform GUI dedup](https://github.com/dupeGuru/dupeGuru)
- [WinDirStat: duplicate files view](https://windirstat.net/)
- [rdfind: CLI dedup with hardlink mode](https://github.com/pauldreik/rdfind)
- [czkawka: multi-functional duplicate finder](https://github.com/qarmin/czkawka)
- [File Hunter: self-hosted web catalog + dedup + treemap](https://github.com/zen-logic/file-hunter)
- [r/selfhosted: "what is the best duplicate file finder"](https://www.reddit.com/r/selfhosted/comments/17yvcyt/)
- [SourceForge: open source duplicate file finders](https://sourceforge.net/directory/duplicate-file-finders/)

## Sources

- [GitHub: filebrowser/filebrowser](https://github.com/filebrowser/filebrowser/issues)
- [GitHub: spacedriveapp/spacedrive](https://github.com/spacedriveapp/spacedrive)
- [GitHub: files-community/Files](https://github.com/files-community/Files)
- [GitHub: homarr-labs/homarr](https://github.com/homarr-labs/homarr)
- [r/selfhosted](https://www.reddit.com/r/selfhosted/)
- [Hacker News: Spacedrive discussion](https://news.ycombinator.com/item?id=31186313)
- [SourceForge: file manager trends](https://sourceforge.net/directory/file-managers/)
- [Awesome Self-Hosted: file managers](https://awesome-selfhosted.net/tags/file-transfer---web-based-file-managers.html)
- [dev.to: FileBrowser mobile alternatives](https://dev.to/johnson998877/filebrowser-alternatives-for-mobile-a-self-hosters-comparison-guide-5ccm)
- [FileRun](https://filerun.com/), [FileRise](https://filerise.net/), [TagSpaces](https://www.tagspaces.org/)
