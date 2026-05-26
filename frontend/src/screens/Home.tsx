import { KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileEntry, Job, SearchResult, BlockDevice, RootEntry, Session, TrashEntry,
  createArchiveJob, createChecksumJob, createCopyJob, createExtractJob,
  createFolder, createMoveJob, deleteTrash, deletePath, downloadUrl, getDevices,
  getFiles, getJobs, getRoots, getTrash, isAudioExtension, isImageExtension,
  isTextExtension, isVideoExtension, renamePath, searchFiles, restoreTrash,
  uploadFiles, getDirSizes, createShare,
} from '../api/client';
import type { ConflictPolicy } from '../api/client';
import { KeyboardShortcuts } from '../components/overlay/KeyboardShortcuts';
import { PreviewModal } from '../components/overlay/PreviewModal';
import { BatchRenameModal } from '../components/overlay/BatchRenameModal';
import { InfoPanel } from '../components/overlay/InfoPanel';
import { ShareDialog } from '../components/overlay/ShareDialog';
import { ShareManager } from '../components/overlay/ShareManager';
import { DiskUsageAnalyzer } from '../components/overlay/DiskUsageAnalyzer';
import { SettingsPanel } from '../pages/SettingsPanel';
import { TopBar } from '../components/layout/TopBar';
import { Dock } from '../components/layout/Dock';
import { StatusBar } from '../components/layout/StatusBar';
import { FilesView } from '../pages/FilesView';
import { DesktopView } from '../pages/DesktopView';
import { TrashView } from '../pages/TrashView';
import { JobsPage } from '../pages/JobsPage';
import { ConfirmDialog, TextInputDialog, TransferDialog } from '../components/overlay/Dialogs';
import type { ConfirmDialogState, TextInputDialogState, TransferDialogState } from '../components/overlay/Dialogs';
import { ToastViewport, type Toast } from '../components/overlay/Toast';
import { FileContextMenu } from '../components/overlay/FileContextMenu';
import { TrashContextMenu } from '../components/overlay/TrashContextMenu';
import { folderIconUrl, preferencesIconUrl, jobsIconUrl, computerIconUrl, trashIconUrl } from '../api/icons';
import { type ViewMode } from '../utils/view';
import { joinPath, normalizeFolderPath, uniquePaths } from '../utils/path';
import { loadWallpaper, saveWallpaper, wallpaperToStyle, type WallpaperConfig } from '../utils/wallpaper';
import { isArchiveFile, archiveBaseName, archiveFileName } from '../utils/archive';
import { useJobs } from '../hooks/useJobs';
import { useDragDrop } from '../hooks/useDragDrop';
import { useRubberBand } from '../hooks/useRubberBand';
import styles from './Home.module.css';

type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';
type ContextMenuState = { x: number; y: number; entry: FileEntry } | null;
type RenameState = { path: string; value: string } | null;
type ClipboardState = { mode: 'copy' | 'move'; entries: FileEntry[] } | null;

interface HomeProps {
  session: Session;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Home({ session, onLogout, theme, onToggleTheme }: HomeProps) {
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [devices, setDevices] = useState<BlockDevice[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(() => localStorage.getItem('volum_currentPath') ?? '');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [folderPrefs, setFolderPrefs] = useState<Record<string, { viewMode?: ViewMode; sortField?: SortField; sortDirection?: SortDirection }>>(() => {
    try { return JSON.parse(localStorage.getItem('volum_folderPrefs') ?? '{}'); } catch { return {}; }
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('volum_viewMode') as ViewMode) || 'grid');
  const [showHidden, setShowHidden] = useState(() => localStorage.getItem('volum_showHidden') === 'true');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<RenameState>(null);
  const [sortField, setSortField] = useState<SortField>(() => (localStorage.getItem('volum_sortField') as SortField) || 'name');
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => (localStorage.getItem('volum_sortDirection') as SortDirection) || 'asc');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('volum_favorites') ?? '[]'); } catch { return []; }
  });
  const [analyzePath, setAnalyzePath] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [infoEntry, setInfoEntry] = useState<FileEntry | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [textInputDialog, setTextInputDialog] = useState<TextInputDialogState>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>(null);
  const [fileClipboard, setFileClipboard] = useState<ClipboardState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [locationMode, setLocationMode] = useState(false);
  const sseConnected = true;
  const [showingTrash, setShowingTrash] = useState(false);
  const [showingSettings, setShowingSettings] = useState(false);
  const [showingJobs, setShowingJobs] = useState(false);
  const [showingMyPC, setShowingMyPC] = useState(false);
  const [wallpaper, setWallpaper] = useState<WallpaperConfig>(loadWallpaper);
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const [lastSelectedTrashId, setLastSelectedTrashId] = useState<string | null>(null);
  const [shareDialogPath, setShareDialogPath] = useState<{ path: string; name: string } | null>(null);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [trashContextMenu, setTrashContextMenu] = useState<{ x: number; y: number; entry: TrashEntry } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileGridRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressEntry = useRef<{ entry: FileEntry; x: number; y: number } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewModeBeforeTrash = useRef<ViewMode | null>(null);

  const canWrite = session.role === 'admin';

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const topBarTitle = useMemo(() => {
    if (showingMyPC && selectedDriveName) {
      const d = devices.find(dd => dd.name === selectedDriveName);
      return d?.model || selectedDriveName;
    }
    if (showingMyPC) return 'My PC';
    if (showingTrash) return 'Trash';
    if (showingSettings) return 'Settings';
    if (showingJobs) return 'Jobs';
    if (currentPath) return 'Files';
    return undefined;
  }, [showingMyPC, selectedDriveName, devices, showingTrash, showingSettings, showingJobs, currentPath]);

  const activeView = useMemo(() => {
    if (showingSettings) return 'settings';
    if (showingJobs) return 'jobs';
    if (showingTrash) return 'trash';
    if (currentPath) return 'files';
    return 'desktop';
  }, [currentPath, showingTrash, showingSettings, showingJobs]);

  const activeJobCount = useMemo(
    () => jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused').length,
    [jobs]
  );

  const dockItems = useMemo(() => [
    { id: 'desktop', label: 'Desktop', icon: computerIconUrl(), active: activeView === 'desktop' },
    { id: 'files', label: 'Files', icon: folderIconUrl('64'), active: activeView === 'files' },
    { id: 'trash', label: 'Trash', icon: trashIconUrl(trashEntries.length > 0, '64'), badge: trashEntries.length > 0 ? trashEntries.length : undefined, active: activeView === 'trash' },
    { id: 'jobs', label: 'Jobs', icon: jobsIconUrl(), badge: activeJobCount > 0 ? activeJobCount : undefined, active: activeView === 'jobs' },
    { id: 'settings', label: 'Settings', icon: preferencesIconUrl(), active: activeView === 'settings' },
  ], [activeView, trashEntries.length, activeJobCount]);

  const dismissToast = (id: number) => setToasts((items) => items.filter((t) => t.id !== id));
  const showToast = (title: string, variant?: 'success' | 'error', message?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((items) => [...items.slice(-3), { title, variant: variant ?? 'success', message, id }]);
    window.setTimeout(() => dismissToast(id), 4000);
  };
  const refresh = () => setRefreshKey((v) => v + 1);

  // ── Effects ──────────────────────────────────────────────

  useEffect(() => {
    getRoots()
      .then((response) => setRoots(response.roots ?? []))
      .catch((err: Error) => setError(err.message));
  }, [session]);

  const loadDevices = useCallback(() => {
    setDeviceError(null);
    getDevices()
      .then((response) => setDevices(response.devices ?? []))
      .catch((err: Error) => setDeviceError(err.message));
  }, []);

  useEffect(() => { loadDevices(); }, [session, loadDevices]);

  useEffect(() => {
    if (!currentPath) return;
    setLoading(true);
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setRenaming(null);
    setContextMenu(null);
    getFiles(currentPath, showHidden)
      .then((response) => { setEntries(response.entries ?? []); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentPath, refreshKey, showHidden]);

  useEffect(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, [renaming]);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const pollingPath = useRef<string | null>(null);

  useEffect(() => {
    if (!currentPath || loading) { pollingPath.current = null; return; }
    if (pollingPath.current === currentPath) return;
    const hasPendingDir = entriesRef.current.some((e) => e.type === 'directory' && e.size === 0);
    if (!hasPendingDir) { pollingPath.current = null; return; }
    pollingPath.current = currentPath;
    const interval = setInterval(async () => {
      try {
        const response = await getDirSizes(currentPath);
        const sizes = response.sizes ?? {};
        setEntries((prev) => {
          let changed = false;
          const next = prev.map((e) => {
            if (sizes[e.path] !== undefined && e.size !== sizes[e.path]) { changed = true; return { ...e, size: sizes[e.path] }; }
            return e;
          });
          if (!changed) return prev;
          const allDone = !next.some((e) => e.type === 'directory' && e.size === 0);
          if (allDone && pollingPath.current === currentPath) pollingPath.current = null;
          return next;
        });
      } catch (e) { console.error('Dir sizes polling failed:', e); }
    }, 500);
    return () => { clearInterval(interval); if (pollingPath.current === currentPath) pollingPath.current = null; };
  }, [currentPath, loading]);

  useEffect(() => {
    getTrash()
      .then((response) => setTrashEntries(response.entries ?? []))
      .catch((err) => console.error('Failed to fetch trash:', err));
  }, [session, refreshKey]);

  const jobHandlers = useJobs(setJobs, {
    session,
    sessionLoading: false,
    onRefresh: refresh,
    showToast,
  });

  const {
    handleCancelJob, handleRetryJob,
    handlePauseJob, handleResumeJob, handleClearCompleted, handleClearFailed,
  } = jobHandlers;

  // ── Keyboard shortcuts ───────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setShortcutsOpen((p) => !p); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); setSearchOpen(true); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); if (activeView === 'files') setLocationMode((v) => !v); }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchResults(null); setQuery(''); }
      if (e.key === 'Escape' && shortcutsOpen) { setShortcutsOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, shortcutsOpen, activeView]);

  // ── Toast helper ─────────────────────────────────────────

  const showToastObj = (toast: Omit<Toast, 'id'>, timeout = 4000) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((items) => [...items.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismissToast(id), timeout);
  };

  const runAction = async (action: () => Promise<unknown>, successTitle?: string) => {
    try {
      await action();
      setError(null);
      if (successTitle) showToastObj({ title: successTitle, variant: 'success' });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      showToastObj({ title: 'Action failed', message, variant: 'error' });
    }
  };

  // ── Navigation ───────────────────────────────────────────

  const navigateTo = (path: string) => {
    const prevPath = currentPathRef.current;
    if (prevPath && prevPath !== path) {
      setFolderPrefs((prev) => ({ ...prev, [prevPath]: { viewMode, sortField, sortDirection } }));
    }
    const prefs = folderPrefs[path];
    if (prefs) {
      if (prefs.viewMode) setViewMode(prefs.viewMode);
      if (prefs.sortField) setSortField(prefs.sortField);
      if (prefs.sortDirection) setSortDirection(prefs.sortDirection);
    }
    setCurrentPath(path);
    setShowingJobs(false);
    localStorage.setItem('volum_currentPath', path);
    setSearchOpen(false);
    setSearchResults(null);
    setQuery('');
    setSelectedDriveName(null);
    setShowingMyPC(false);
  };

  // ── Handlers: Folder / Rename / Delete ───────────────────

  const handleCreateFolder = () => {
    setContextMenu(null);
    setTextInputDialog({
      title: 'New Folder',
      label: 'Folder name',
      placeholder: 'Folder name',
      confirmLabel: 'Create',
      onSubmit: (value) => { void runAction(() => createFolder(currentPath, value.trim()), 'Folder created'); }
    });
  };

  const handleRename = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) return;
    setContextMenu(null);
    setSelectedPaths([entry.path]);
    setLastSelectedPath(entry.path);
    setRenaming({ path: entry.path, value: entry.name });
  };

  const cancelRename = () => setRenaming(null);

  const commitRename = (entry: FileEntry) => {
    if (renaming?.path !== entry.path) return;
    const nextName = renaming.value.trim();
    if (!nextName || nextName === entry.name) { cancelRename(); return; }
    const oldName = entry.name;
    const oldPath = entry.path;
    setRenaming(null);
    void runAction(() => renamePath(oldPath, nextName), 'Item renamed');
    showToastObj({
      title: 'Item renamed', message: `${oldName} → ${nextName}`, variant: 'success',
      action: { label: 'Undo', onClick: () => { void runAction(() => renamePath(joinPath(oldPath.substring(0, oldPath.lastIndexOf('/')), nextName), oldName), 'Rename undone'); } }
    }, 8000);
  };

  const handleDelete = () => {
    if (selectedEntries.length === 0) return;
    const entriesToDelete = [...selectedEntries];
    const label = entriesToDelete.length === 1 ? `"${entriesToDelete[0].name}"` : `${entriesToDelete.length} selected items`;
    setConfirmDialog({
      title: 'Move to Trash',
      message: `Move ${label} to trash? You can restore it from the Trash panel.`,
      confirmLabel: 'Move to Trash',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          for (const entry of entriesToDelete) await deletePath(entry.path, entry.name);
          const response = await getTrash();
          setTrashEntries(response.entries ?? []);
        }, 'Moved to trash');
      }
    });
  };

  // ── Handlers: Trash ──────────────────────────────────────

  const handleRestoreTrash = (entry: TrashEntry) => {
    void runAction(async () => { await restoreTrash(entry.id); const r = await getTrash(); setTrashEntries(r.entries ?? []); });
    showToastObj({ title: 'Item restored', message: entry.originalPath, variant: 'success', action: { label: 'Undo', onClick: () => { void deletePath(entry.originalPath, entry.name); getTrash().then((r) => setTrashEntries(r.entries ?? [])); showToastObj({ title: 'Restore undone', variant: 'success' }); } } }, 8000);
  };

  const handleDeleteTrash = (entry: TrashEntry) => {
    setTrashContextMenu(null);
    setConfirmDialog({
      title: 'Delete Permanently',
      message: `Permanently delete "${entry.name}"? This cannot be undone.`,
      confirmLabel: 'Delete Permanently', danger: true,
      onConfirm: () => { void runAction(async () => { await deleteTrash(entry.id); const r = await getTrash(); setTrashEntries(r.entries ?? []); }, 'Item deleted permanently'); }
    });
  };

  const handleSelectTrashItem = (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
    setTrashContextMenu(null);
    if (event.shiftKey && lastSelectedTrashId) {
      const allEntries = trashEntries;
      const from = allEntries.findIndex((e) => e.id === lastSelectedTrashId);
      const to = allEntries.findIndex((e) => e.id === entry.id);
      if (from !== -1 && to !== -1) { const [start, end] = from < to ? [from, to] : [to, from]; setSelectedTrashIds(allEntries.slice(start, end + 1).map((e) => e.id)); return; }
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedTrashIds((prev) => prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]);
      setLastSelectedTrashId(entry.id); return;
    }
    if (selectedTrashIds.includes(entry.id) && selectedTrashIds.length === 1) { setSelectedTrashIds([]); setLastSelectedTrashId(null); return; }
    setSelectedTrashIds([entry.id]);
    setLastSelectedTrashId(entry.id);
  };

  const handleTrashContextMenu = (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (!selectedTrashIds.includes(entry.id)) { setSelectedTrashIds([entry.id]); setLastSelectedTrashId(entry.id); }
    setTrashContextMenu({ x: event.clientX, y: event.clientY, entry });
  };

  // ── Handlers: Preview / Info / Download / Batch ──────────

  const handleDownload = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) return;
    window.location.href = downloadUrl(entry.path);
  };

  const handlePreview = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry || entry.type !== 'file') return;
    if (isImageExtension(entry.name.toLowerCase()) || isVideoExtension(entry.name.toLowerCase()) || isAudioExtension(entry.name.toLowerCase()) || isTextExtension(entry.name.toLowerCase())) {
      setPreviewEntry(entry);
    } else {
      window.open(downloadUrl(entry.path), '_blank');
    }
  };

  const handleShowInfo = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) return;
    setContextMenu(null);
    setInfoEntry(entry);
  };

  const handleBatchRename = () => setBatchRenameOpen(true);

  const handleUploadFiles = (files: FileList | File[]) => {
    if (!canWrite) return;
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0 || !currentPath) return;
    void runAction(async () => {
      await uploadFiles(currentPath, selectedFiles);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, `${selectedFiles.length} upload${selectedFiles.length === 1 ? '' : 's'} started`);
  };

  // ── Handlers: Transfer / Clipboard ───────────────────────

  const handleCopy = () => {
    if (!canCopy) return;
    setContextMenu(null);
    setTransferDialog({ mode: 'copy', entries: [...selectedEntries], initialDestination: currentPath });
  };

  const handleMove = () => {
    if (!canMove) return;
    setContextMenu(null);
    setTransferDialog({ mode: 'move', entries: [...selectedEntries], initialDestination: currentPath });
  };

  const setClipboardFromSelection = (mode: 'copy' | 'move') => {
    if (!canWrite || selectedEntries.length === 0) return;
    const entriesToStore = [...selectedEntries];
    setFileClipboard({ mode, entries: entriesToStore });
    showToastObj({ title: mode === 'copy' ? 'Copied to clipboard' : 'Cut to clipboard', message: `${entriesToStore.length} item${entriesToStore.length === 1 ? '' : 's'}`, variant: 'success' });
  };

  const handlePaste = () => {
    if (!fileClipboard || !canWrite) return;
    setContextMenu(null);
    setTransferDialog({ mode: fileClipboard.mode, entries: [...fileClipboard.entries], initialDestination: currentPath });
  };

  const handleQuickShare = async () => {
    const entry = contextMenu?.entry;
    if (!entry) return;
    setContextMenu(null);
    try {
      const share = await createShare({ path: entry.path });
      await navigator.clipboard.writeText(`${window.location.origin}/api/public/${share.token}`);
      showToastObj({ title: 'Share link copied to clipboard', variant: 'success' });
    } catch (err) {
      showToastObj({ title: 'Quick share failed', message: err instanceof Error ? err.message : undefined, variant: 'error' });
    }
  };

  const handleTransferSubmit = (dialog: TransferDialogState, destinationValue: string, conflictPolicy: ConflictPolicy) => {
    if (!dialog) return;
    const destinations = destinationValue.split('|').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
    if (destinations.length === 0) return;
    setTransferDialog(null);
    void runAction(async () => {
      for (const entry of dialog.entries) {
        for (const dest of destinations) {
          const targetPath = joinPath(dest, entry.name);
          if (dialog.mode === 'copy') await createCopyJob(entry.path, targetPath, conflictPolicy);
          else await createMoveJob(entry.path, targetPath, conflictPolicy);
        }
      }
      if (dialog.mode === 'move') setFileClipboard(null);
    }, dialog.mode === 'copy' ? 'Copy job started' : 'Move job started');
  };

  // ── Handlers: Archive / Checksum ─────────────────────────

  const handleCreateArchiveWithPreview = (entry: FileEntry, targetPath: string, archiveName: string) => {
    getFiles(currentPath, false).then((response) => {
      const entries2 = response.entries ?? [];
      const conflict = entries2.find((e) => e.name === archiveName);
      if (conflict) {
        setConfirmDialog({
          title: 'Archive Already Exists',
          message: `"${archiveName}" already exists in ${currentPath}. Overwrite it?`,
          confirmLabel: 'Overwrite',
          danger: true,
          onConfirm: () => { void runAction(() => createArchiveJob(entry.path, targetPath, 'overwrite'), 'Archive job started'); }
        });
      } else {
        void runAction(() => createArchiveJob(entry.path, targetPath, 'rename'), 'Archive job started');
      }
    }).catch(() => { void runAction(() => createArchiveJob(entry.path, targetPath, 'rename'), 'Archive job started'); });
  };

  const handleCreateArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) return;
    const aName = archiveFileName(entry.name);
    const defaultPath = joinPath(currentPath, aName);
    setContextMenu(null);
    setTextInputDialog({
      title: 'Create Archive', label: 'Archive path', initialValue: defaultPath,
      placeholder: defaultPath, confirmLabel: 'Create Archive',
      folderSuggestions, suggestionLabel: 'Create in',
      applyFolderSuggestion: (path) => joinPath(path, aName),
      onSubmit: (value) => { handleCreateArchiveWithPreview(entry, value.trim(), aName); }
    });
  };

  const handleExtractArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1 || entry.type !== 'file' || !isArchiveFile(entry.name)) return;
    const defaultPath = joinPath(currentPath, archiveBaseName(entry.name));
    setContextMenu(null);
    setTextInputDialog({
      title: 'Extract Archive', label: 'Destination folder path',
      initialValue: defaultPath, placeholder: defaultPath, confirmLabel: 'Extract',
      folderSuggestions, suggestionLabel: 'Extract to',
      applyFolderSuggestion: (path) => normalizeFolderPath(path),
      onSubmit: (value) => {
        const dest = value.trim();
        getFiles(dest, false).then((response) => {
          const existing = response.entries ?? [];
          if (existing.length > 0) {
            setConfirmDialog({
              title: 'Destination Not Empty',
              message: `The destination folder contains ${existing.length} item${existing.length === 1 ? '' : 's'}. Extract here anyway? Existing files with the same name may be renamed.`,
              confirmLabel: 'Extract Anyway',
              onConfirm: () => { void runAction(() => createExtractJob(entry.path, dest), 'Extract job started'); }
            });
          } else {
            void runAction(() => createExtractJob(entry.path, dest), 'Extract job started');
          }
        }).catch(() => { void runAction(() => createExtractJob(entry.path, dest), 'Extract job started'); });
      }
    });
  };

  const handleAnalyze = () => {
    const entry = selectedEntries[0];
    if (!entry || entry.type !== 'directory') return;
    setContextMenu(null);
    setAnalyzePath(entry.path);
  };

  const handleCreateChecksum = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Generate Checksum', label: 'Verify mode', initialValue: 'sha256',
      placeholder: 'sha256', confirmLabel: 'Generate',
      onSubmit: (value) => { const mode = value.trim().toLowerCase() === 'md5' ? 'md5' : 'sha256'; void runAction(() => createChecksumJob(entry.path, mode), `Checksum (${mode}) job started`); }
    });
  };

  // ── Handlers: Selection ──────────────────────────────────

  const handleSelectAll = () => {
    const nextPaths = filteredEntries.map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
  };

  const handleInvertSelection = () => {
    const nextPaths = filteredEntries.filter((entry) => !selectedPaths.includes(entry.path)).map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
  };

  const handleSelectEntry = (entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    if (renaming) return;
    setContextMenu(null);
    if (event.shiftKey && lastSelectedPath) {
      const from = filteredEntries.findIndex((item) => item.path === lastSelectedPath);
      const to = filteredEntries.findIndex((item) => item.path === entry.path);
      if (from !== -1 && to !== -1) { const [start, end] = from < to ? [from, to] : [to, from]; setSelectedPaths(filteredEntries.slice(start, end + 1).map((item) => item.path)); return; }
    }
    if (event.metaKey || event.ctrlKey) {
      if (selectedPaths.includes(entry.path)) { const next = selectedPaths.filter((p) => p !== entry.path); setSelectedPaths(next); setLastSelectedPath(next.length > 0 ? next[next.length - 1] : null); }
      else { setSelectedPaths([...selectedPaths, entry.path]); setLastSelectedPath(entry.path); }
      return;
    }
    if (selectedPaths.includes(entry.path)) { setSelectedPaths((paths) => paths.filter((p) => p !== entry.path)); setLastSelectedPath(null); return; }
    setSelectedPaths([entry.path]);
    setLastSelectedPath(entry.path);
  };

  const handleContextMenuEvent = (entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (renaming) return;
    if (!selectedPaths.includes(entry.path)) { setSelectedPaths([entry.path]); setLastSelectedPath(entry.path); }
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  };

  // ── Handlers: File area keyboard ─────────────────────────

  const handleFileAreaKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (renaming) { if (event.key === 'Escape') cancelRename(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); handleSelectAll(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); setClipboardFromSelection('copy'); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') { event.preventDefault(); setClipboardFromSelection('move'); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); handlePaste(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') { event.preventDefault(); handleInvertSelection(); return; }
    if (event.key === 'F2' && canWrite && canRename) { event.preventDefault(); handleRename(); return; }
    if (event.key === 'Delete' && canWrite && canDelete) { event.preventDefault(); handleDelete(); return; }
    if (event.key === 'Escape') { setSelectedPaths([]); setContextMenu(null); setLastSelectedPath(null); return; }
    if (event.key === 'Enter' && selectedEntries.length === 1) {
      if (selectedEntries[0].type === 'directory') navigateTo(selectedEntries[0].path);
      else handlePreview();
    }
  };

  // ── File area click / workspace click ────────────────────

  const handleFileAreaClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    setSelectedPaths([]); setLastSelectedPath(null); setRenaming(null); setContextMenu(null);
  };

  const handleWorkspaceClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    setSelectedPaths([]); setLastSelectedPath(null); setRenaming(null); setContextMenu(null);
  };

  // ── Touch handlers (mobile long-press context menu) ──────

  const handleEntryTouchStart = (entry: FileEntry, event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    longPressEntry.current = { entry, x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      const lp = longPressEntry.current;
      if (lp) { setContextMenu({ x: lp.x, y: lp.y, entry: lp.entry }); longPressEntry.current = null; }
    }, 500);
  };

  const handleEntryTouchMove = () => { longPressEntry.current = null; if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };
  const handleEntryTouchEnd = () => { if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };

  // ── Desktop handlers ─────────────────────────────────────

  const handleDesktopNavigateToTrash = () => {
    setCurrentPath('');
    setShowingTrash(true);
    setShowingSettings(false);
    setShowingJobs(false);
    setShowingMyPC(false);
    setSelectedPaths([]);
    setSelectedDriveName(null);
    if (viewMode === 'columns') viewModeBeforeTrash.current = viewMode;
    setViewMode((prev) => prev === 'columns' ? 'list' : prev);
  };

  const handleDockActivate = (id: string) => {
    switch (id) {
      case 'desktop': setCurrentPath(''); setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null); break;
      case 'files':
        setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null);
        if (!currentPath) { const target = roots.find((r) => r.available)?.path; if (target) navigateTo(target); }
        break;
      case 'trash': setCurrentPath(''); setShowingTrash(true); setShowingSettings(false); setShowingJobs(false); setViewMode((prev) => prev === 'columns' ? 'list' : prev); break;
      case 'jobs': setShowingJobs(true); setShowingSettings(false); setShowingTrash(false); setShowingMyPC(false); setSelectedDriveName(null); break;
      case 'settings': setShowingSettings(true); setShowingTrash(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null); break;
    }
  };

  // ── Search handler ───────────────────────────────────────

  const handleGlobalSearch = (searchQuery: string) => {
    if (searchQuery.trim().length < 2) { setSearchResults(null); return; }
    searchFiles(searchQuery.trim(), 20).then((response) => setSearchResults(response.results ?? [])).catch(() => setSearchResults([]));
  };

  // ── Favorites ────────────────────────────────────────────

  const persistFavorites = (items: string[]) => { setFavorites(items); localStorage.setItem('volum_favorites', JSON.stringify(items)); };
  const addFavorite = (path: string) => { if (!favorites.includes(path)) persistFavorites([...favorites, path]); };
  const removeFavorite = (path: string) => { persistFavorites(favorites.filter((f) => f !== path)); };

  // ── Derived values ───────────────────────────────────────

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? entries.filter((e) => e.name.toLowerCase().includes(needle)) : entries;
    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'size') return (a.size - b.size) * dir;
      if (sortField === 'modifiedAt') return (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()) * dir;
      const aVal = sortField === 'type' ? a.type : a.name;
      const bVal = sortField === 'type' ? b.type : b.name;
      return aVal.localeCompare(bVal) * dir;
    });
  }, [entries, query, sortDirection, sortField]);

  const selectedEntries = useMemo(() => filteredEntries.filter((e) => selectedPaths.includes(e.path)), [filteredEntries, selectedPaths]);

  const sortedTrashEntries = useMemo(() => {
    return [...trashEntries].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortField === 'size') return (a.size - b.size) * dir;
      if (sortField === 'type') return a.type.localeCompare(b.type) * dir;
      return (new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime()) * dir;
    });
  }, [trashEntries, sortField, sortDirection]);

  const canRename = selectedEntries.length === 1;
  const canDownload = selectedEntries.length === 1;
  const canDelete = selectedEntries.length > 0;
  const canCopy = selectedEntries.length > 0;
  const canMove = selectedEntries.length > 0;
  const canInfo = selectedEntries.length === 1;
  const canPreview = selectedEntries.length === 1 && selectedEntries[0]?.type === 'file';
  const canArchive = selectedEntries.length === 1;
  const canExtract = selectedEntries.length === 1 && selectedEntries[0]?.type === 'file' && isArchiveFile(selectedEntries[0]?.name ?? '');
  const canAnalyze = selectedEntries.length === 1 && selectedEntries[0]?.type === 'directory';
  const canChecksum = canWrite && selectedEntries.length === 1;
  const canPaste = canWrite && !!fileClipboard && fileClipboard.entries.length > 0;

  const currentRoot = useMemo(() => {
    if (!currentPath) return null;
    return roots.find((r) => currentPath.startsWith(r.path)) ?? null;
  }, [currentPath, roots]);

  const selectedFileBytes = useMemo(() => {
    let total = 0;
    selectedEntries.forEach((entry) => { if (entry.size) total += entry.size; });
    return total;
  }, [selectedEntries]);

  const isFavorited = favorites.includes(currentPath);
  const selectedEntryIsFavorited = contextMenu?.entry ? favorites.includes(contextMenu.entry.path) : isFavorited;
  const showStatusBar = activeView !== 'settings' && activeView !== 'jobs';

  const folderSuggestions = useMemo(
    () => uniquePaths([currentPath, ...roots.map((r) => r.path), ...devices.flatMap((d) => (d.partitions ?? []).filter((p) => p.volumPath).map((p) => p.volumPath!))]),
    [currentPath, roots, devices]
  );

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((part, index) => ({ label: part, path: `/${parts.slice(0, index + 1).join('/')}` }));
  }, [currentPath]);

  // ── Drag & Drop ──────────────────────────────────────────

  const dragDrop = useDragDrop(canWrite, filteredEntries, selectedPaths, setTransferDialog, handleUploadFiles);

  // ── Rubber band ──────────────────────────────────────────

  const { rubberBandStyle, handleFileAreaMouseDown } = useRubberBand(filteredEntries, setSelectedPaths, setLastSelectedPath, fileGridRef);

  // ── Context menu close on click/resize ───────────────────

  useEffect(() => {
    const closeMenus = () => { setContextMenu(null); setTrashContextMenu(null); };
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    return () => { window.removeEventListener('click', closeMenus); window.removeEventListener('resize', closeMenus); };
  }, []);

  // ── LocalStorage sync effects ────────────────────────────

  useEffect(() => {
    if (currentPath && folderPrefs[currentPath]) {
      const prefs = folderPrefs[currentPath];
      if (prefs.viewMode) setViewMode(prefs.viewMode);
      if (prefs.sortField) setSortField(prefs.sortField);
      if (prefs.sortDirection) setSortDirection(prefs.sortDirection);
    }
    // This intentionally applies the persisted preference only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { localStorage.setItem('volum_viewMode', viewMode); }, [viewMode]);
  useEffect(() => {
    if (!showingTrash && viewModeBeforeTrash.current) { setViewMode(viewModeBeforeTrash.current); viewModeBeforeTrash.current = null; }
  }, [showingTrash]);
  useEffect(() => { localStorage.setItem('volum_sortField', sortField); localStorage.setItem('volum_sortDirection', sortDirection); }, [sortField, sortDirection]);
  useEffect(() => {
    const path = currentPath;
    if (path) {
      setFolderPrefs((prev) => ({ ...prev, [path]: { viewMode, sortField, sortDirection } }));
    }
  }, [currentPath, viewMode, sortField, sortDirection]);
  useEffect(() => { localStorage.setItem('volum_folderPrefs', JSON.stringify(folderPrefs)); }, [folderPrefs]);
  useEffect(() => { localStorage.setItem('volum_showHidden', String(showHidden)); }, [showHidden]);
  useEffect(() => { saveWallpaper(wallpaper); }, [wallpaper]);
  useEffect(() => { if (Notification.permission === 'default') void Notification.requestPermission(); }, []);

  // ── Shell JSX ────────────────────────────────────────────

  const shell = (
    <>
      <main className={styles.appShell}>
        <TopBar
          activeView={activeView}
          title={topBarTitle}
          onGoDesktop={() => { setCurrentPath(''); setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null); }}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenSettings={() => setShowingSettings(true)}
          onLogout={onLogout}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          session={session}
          menuHandlers={{
            onCreateFolder: handleCreateFolder,
            onUpload: () => fileInputRef.current?.click(),
            onCut: () => setClipboardFromSelection('move'),
            onCopy: () => setClipboardFromSelection('copy'),
            onPaste: handlePaste,
            onSelectAll: handleSelectAll,
            onInvertSelection: handleInvertSelection,
            onRename: handleRename,
            onDelete: handleDelete,
            viewMode,
            onSetViewMode: setViewMode,
            showHidden,
            onToggleHidden: () => setShowHidden((v) => !v),
            sortField,
            sortDirection,
            onSortChange: (value) => { const [f, d] = value.split(':') as [SortField, SortDirection]; setSortField(f); setSortDirection(d); },
            onGoDesktop: () => { setCurrentPath(''); setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null); },
            onGoFiles: () => { setShowingMyPC(false); handleDockActivate('files'); },
            onGoTrash: () => { setCurrentPath(''); setShowingTrash(true); setShowingSettings(false); setShowingJobs(false); setViewMode((prev) => prev === 'columns' ? 'list' : prev); },
            onGoJobs: () => { setShowingJobs(true); setShowingSettings(false); setShowingTrash(false); setShowingMyPC(false); setSelectedDriveName(null); },
            onGoSettings: () => { setShowingSettings(true); setShowingTrash(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null); },
            onToggleLocation: () => setLocationMode((v) => !v),
            canWrite,
          }}
        />
        <Dock items={dockItems} onActivate={handleDockActivate} />

        <section className={styles.workspace} onClick={handleWorkspaceClick}>
          {activeView === 'desktop' && (
            <DesktopView
              devices={devices} trashEntries={trashEntries} jobs={jobs}
              favorites={favorites}
              selectedDriveName={selectedDriveName}
              onNavigateTo={navigateTo}
              onNavigateToTrash={handleDesktopNavigateToTrash}
              onOpenSettings={() => { setShowingSettings(true); setShowingTrash(false); setShowingMyPC(false); setSelectedDriveName(null); }}
              onOpenJobs={() => { setShowingJobs(true); setShowingSettings(false); setShowingTrash(false); setShowingMyPC(false); setSelectedDriveName(null); }}
              onOpenFiles={() => { setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setShowingMyPC(false); setSelectedDriveName(null); handleDockActivate('files'); }}
              onSelectDrive={setSelectedDriveName}
              showingMyPC={showingMyPC}
              onShowMyPC={setShowingMyPC}
              deviceError={deviceError} onRetryDevices={loadDevices}
              wallpaperStyle={wallpaperToStyle(wallpaper)}
            />
          )}
          {activeView === 'trash' && (
            <TrashView
              trashEntries={trashEntries} selectedTrashIds={selectedTrashIds}
              onSelectTrash={handleSelectTrashItem}
              sortedTrashEntries={sortedTrashEntries}
              onTrashContextMenu={handleTrashContextMenu}
            />
          )}
          {activeView === 'files' && (
            <FilesView
              currentPath={currentPath} breadcrumbs={breadcrumbs}
              onNavigate={navigateTo}
              onGoUp={() => setCurrentPath('')}
              onRefresh={refresh}
              entries={entries} filteredEntries={filteredEntries}
              selectedPaths={selectedPaths}
              onSelectEntry={handleSelectEntry}
              viewMode={viewMode}
              loading={loading} error={error} sseConnected={sseConnected}
              onDismissError={() => setError(null)}
              canWrite={canWrite} isFavorited={isFavorited}
              favorites={favorites}
              onToggleFavorite={() => isFavorited ? removeFavorite(currentPath) : addFavorite(currentPath)}
              query={query} searchOpen={searchOpen} searchResults={searchResults}
              onSearch={(q) => { setQuery(q); if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => handleGlobalSearch(q), 200); setSearchOpen(true); }}
              onClearSearch={() => { setQuery(''); setSearchResults(null); setSearchOpen(false); }}
              onSearchResultClick={(result) => {
                if (result.type === 'directory') navigateTo(result.path);
                else { const idx = result.path.lastIndexOf('/'); navigateTo(idx < 0 ? '/' : result.path.substring(0, idx) || '/'); }
              }}
              searchRef={searchRef as React.RefObject<HTMLInputElement>}
              fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
              onUpload={handleUploadFiles}
              fileClick={handleFileAreaClick}
              contextMenu={contextMenu} onContextMenu={handleContextMenuEvent} onCloseContextMenu={() => setContextMenu(null)}
              draggingUpload={dragDrop.draggingUpload}
              onFileAreaDragOver={dragDrop.handleFileAreaDragOver}
              onFileAreaDragLeave={dragDrop.handleFileAreaDragLeave}
              onFileAreaDrop={dragDrop.handleFileAreaDrop}
              onFileAreaMouseDown={handleFileAreaMouseDown}
              onFileAreaKeyDown={handleFileAreaKeyDown}
              onFileDragStart={dragDrop.handleFileDragStart}
              onFolderDragOver={dragDrop.handleFolderDragOver}
              onFolderDragLeave={dragDrop.handleFolderDragLeave}
              onDropOnFolder={dragDrop.handleDropOnFolder}
              dragOverPath={dragDrop.dragOverPath}
              renameState={renaming}
              renameInputRef={renameInputRef as React.RefObject<HTMLInputElement>}
              onSubmitRename={commitRename} onCancelRename={cancelRename}
              onRenameChange={(value) => setRenaming({ path: renaming?.path ?? '', value })}
              rubberBandStyle={rubberBandStyle}
              onPreview={(entry) => {
                const ext = entry.name.toLowerCase();
                if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext)) setPreviewEntry(entry);
                else window.open(downloadUrl(entry.path), '_blank');
              }}
              fileGridRef={fileGridRef as React.RefObject<HTMLDivElement>}
              onEntryTouchStart={handleEntryTouchStart}
              onEntryTouchMove={handleEntryTouchMove}
              onEntryTouchEnd={handleEntryTouchEnd}
              locationMode={locationMode}
              onLocationNavigate={(path: string) => navigateTo(path.startsWith('/') ? path : `/${path}`)}
              onToggleLocationMode={() => setLocationMode((v) => !v)}
            />
          )}
          {activeView === 'jobs' && (
            <JobsPage
              jobs={jobs}
              completedCollapsed={completedCollapsed} setCompletedCollapsed={setCompletedCollapsed}
              onCancel={handleCancelJob} onPause={handlePauseJob}
              onResume={handleResumeJob} onRetry={handleRetryJob}
              onClearCompleted={handleClearCompleted} onClearFailed={handleClearFailed}
            />
          )}
          {activeView === 'settings' && (
            <SettingsPanel
              onOpenShares={() => { setShowingSettings(false); setSharesOpen(true); }}
              wallpaper={wallpaper}
              onWallpaperChange={setWallpaper}
            />
          )}

          {contextMenu && (
            <FileContextMenu
              x={contextMenu.x} y={contextMenu.y}
              canPreview={canPreview} canInfo={canInfo} canDownload={canDownload}
              canRename={canRename} canArchive={canArchive} canExtract={canExtract}
              canChecksum={canChecksum} canCopy={canCopy} canMove={canMove}
              canPaste={canPaste} canDelete={canDelete} canWrite={canWrite}
              canAnalyze={canAnalyze}
              isFavorited={selectedEntryIsFavorited}
              selectedCount={selectedEntries.length}
              onPreview={handlePreview} onShowInfo={handleShowInfo} onDownload={handleDownload}
              onRename={handleRename} onBatchRename={handleBatchRename}
              onCopy={handleCopy} onMove={handleMove}
              onArchive={handleCreateArchive} onExtract={handleExtractArchive}
              onChecksum={handleCreateChecksum} onPaste={handlePaste}
              onQuickShare={handleQuickShare}
              onShare={() => { const e = contextMenu.entry; if (e) setShareDialogPath({ path: e.path, name: e.name }); }}
              onAnalyze={handleAnalyze}
              onToggleFavorite={() => {
                const e = contextMenu.entry;
                if (e) {
                  if (favorites.includes(e.path)) removeFavorite(e.path);
                  else addFavorite(e.path);
                }
              }}
              onDelete={handleDelete} onClose={() => setContextMenu(null)}
            />
          )}
          {trashContextMenu && canWrite && (
            <TrashContextMenu
              x={trashContextMenu.x} y={trashContextMenu.y}
              onRestore={() => handleRestoreTrash(trashContextMenu.entry)}
              onDeletePermanently={() => handleDeleteTrash(trashContextMenu.entry)}
              onClose={() => setTrashContextMenu(null)}
            />
          )}
        </section>

        <StatusBar
          visible={showStatusBar}
          totalItems={activeView === 'trash' ? trashEntries.length : entries.length}
          selectedCount={activeView === 'trash' ? selectedTrashIds.length : selectedPaths.length}
          totalBytes={selectedFileBytes}
          rootAvail={currentRoot?.freeBytes ?? null}
          rootSize={currentRoot?.totalBytes ?? null}
          rootLabel={currentRoot?.label || currentRoot?.path || ''}
          currentPath={currentPath}
          viewContext={activeView}
          trashCount={trashEntries.length}
        />
      </main>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );

  // ── Overlay rendering ────────────────────────────────────

  if (previewEntry) return <>{shell}<PreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} /></>;
  if (infoEntry) return <>{shell}<InfoPanel entry={infoEntry} onClose={() => setInfoEntry(null)} onRefresh={refresh} /></>;
  if (batchRenameOpen) return <>{shell}<BatchRenameModal entries={selectedEntries} onClose={() => setBatchRenameOpen(false)} onDone={() => { showToastObj({ title: 'Items renamed', variant: 'success' }); refresh(); }} /></>;
  if (confirmDialog) return <>{shell}<ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} /></>;
  if (textInputDialog) return <>{shell}<TextInputDialog dialog={textInputDialog} onClose={() => setTextInputDialog(null)} /></>;
  if (transferDialog) return <>{shell}<TransferDialog dialog={transferDialog} folderSuggestions={folderSuggestions} onClose={() => setTransferDialog(null)} onSubmit={handleTransferSubmit} /></>;
  if (shareDialogPath) return <>{shell}<ShareDialog path={shareDialogPath.path} name={shareDialogPath.name} onClose={() => setShareDialogPath(null)} /></>;
  if (shortcutsOpen) return <>{shell}<KeyboardShortcuts onClose={() => setShortcutsOpen(false)} /></>;
  if (sharesOpen) return <>{shell}<ShareManager onClose={() => setSharesOpen(false)} /></>;
  if (analyzePath) return <>{shell}<DiskUsageAnalyzer path={analyzePath} onClose={() => setAnalyzePath(null)} /></>;
  return shell;
}
