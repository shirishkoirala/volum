import { DragEvent, FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import {
  ConflictPolicy,
  FileEntry,
  Job,
  SearchResult,
  BlockDevice,
  cancelJob,
  createArchiveJob,
  createChecksumJob,
  createCopyJob,
  createExtractJob,
  createFolder,
  createMoveJob,
  deleteTrash,
  deletePath,
  downloadUrl,
  getDevices,
  getFiles,
  getJobs,
  getRoots,
  getSession,
  getTrash,
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isVideoExtension,
  login,
  logout,
  pauseJob,
  renamePath,
  RootEntry,
  Session,
  searchFiles,
  TrashEntry,
  resumeJob,
  retryJob,
  retryJobItem,
  restoreTrash,
  uploadFiles,
  clearCompletedJobs,
  clearFailedJobs,
  chmodPath,
  getDirSizes,
  createShare
} from './api/client';
import appIcon from './assets/icon-light.png';
import { PreviewModal } from './components/PreviewModal';
import { BatchRenameModal } from './components/BatchRenameModal';
import { Select } from './components/Select';
import { InfoPanel } from './components/InfoPanel';
import { ShareDialog } from './components/ShareDialog';
import { ShareManager } from './components/ShareManager';
import { SettingsPanel } from './components/SettingsPanel';
import { TopBar } from './components/TopBar';
import { Dock } from './components/Dock';
import { FilesSidebar } from './components/FilesSidebar';
import { StatusBar } from './components/StatusBar';
import { Overlay } from './components/shared';
import { folderIconUrl, preferencesIconUrl, jobsIconUrl, computerIconUrl, trashIconUrl } from './api/icons';
import { ConfirmDialog, TextInputDialog, TransferDialog, ToastViewport } from './components/Dialogs';
import { JobsPage } from './components/JobsPage';
import { DesktopView } from './components/DesktopView';
import { TrashView } from './components/TrashView';
import { FilesView } from './components/FilesView';
import type { ConfirmDialogState, TextInputDialogState, TransferDialogState, Toast } from './components/Dialogs';
import styles from './App.module.css';

type ViewMode = 'list' | 'grid' | 'columns';
type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';
type ContextMenuState = {
  x: number;
  y: number;
  entry: FileEntry;
} | null;
type RenameState = {
  path: string;
  value: string;
} | null;
type ClipboardState = {
  mode: 'copy' | 'move';
  entries: FileEntry[];
} | null;

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('volum_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [devices, setDevices] = useState<BlockDevice[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(
    () => localStorage.getItem('volum_currentPath') ?? ''
  );
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const knownJobIds = useRef(new Set<string>());
  const jobStatuses = useRef(new Map<string, string>());
  const rubberBand = useRef<{ startX: number; startY: number; endX: number; endY: number; active: boolean }>({ startX: 0, startY: 0, endX: 0, endY: 0, active: false });
  const [rubberBandStyle, setRubberBandStyle] = useState<React.CSSProperties | null>(null);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('volum_viewMode') as ViewMode) || 'grid';
  });
  const [showHidden, setShowHidden] = useState(() => {
    return localStorage.getItem('volum_showHidden') === 'true';
  });
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<RenameState>(null);
  const [sortField, setSortField] = useState<SortField>(() => {
    return (localStorage.getItem('volum_sortField') as SortField) || 'name';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (localStorage.getItem('volum_sortDirection') as SortDirection) || 'asc';
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [draggingPaths, setDraggingPaths] = useState<string[] | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('volum_favorites') ?? '[]'); } catch { return []; }
  });
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('volum_recent') ?? '[]'); } catch { return []; }
  });
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
  const [sseConnected, setSseConnected] = useState(true);
  const [showingTrash, setShowingTrash] = useState(false);
  const [showingSettings, setShowingSettings] = useState(false);
  const [showingJobs, setShowingJobs] = useState(false);
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const [lastSelectedTrashId, setLastSelectedTrashId] = useState<string | null>(null);
  const [shareDialogPath, setShareDialogPath] = useState<{ path: string; name: string } | null>(null);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('volum_sectionCollapsed') ?? '{}'); } catch { return {}; }
  });
  const [trashContextMenu, setTrashContextMenu] = useState<{
    x: number; y: number; entry: TrashEntry;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileGridRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressEntry = useRef<{ entry: FileEntry; x: number; y: number } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewModeBeforeTrash = useRef<ViewMode | null>(null);

  const canWrite = session?.role === 'admin';

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
    {
      id: 'desktop',
      label: 'Desktop',
      icon: computerIconUrl(),
      active: activeView === 'desktop',
    },
    {
      id: 'files',
      label: 'Files',
      icon: folderIconUrl('64'),
      active: activeView === 'files',
    },
    {
      id: 'trash',
      label: 'Trash',
      icon: trashIconUrl(trashEntries.length > 0, '64'),
      badge: trashEntries.length > 0 ? trashEntries.length : undefined,
      active: activeView === 'trash',
    },
    {
      id: 'jobs',
      label: 'Jobs',
      icon: jobsIconUrl(),
      badge: activeJobCount > 0 ? activeJobCount : undefined,
      active: activeView === 'jobs',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: preferencesIconUrl(),
      active: activeView === 'settings',
    },
  ], [activeView, trashEntries.length, activeJobCount]);

  const handleDockActivate = (id: string) => {
    switch (id) {
      case 'desktop':
        setCurrentPath('');
        setShowingTrash(false);
        setShowingSettings(false);
        setShowingJobs(false);
        setSelectedDriveName(null);
        break;
      case 'files':
        setShowingTrash(false);
        setShowingSettings(false);
        setShowingJobs(false);
        setSelectedDriveName(null);
        if (!currentPath) {
          const target = favorites.length > 0 ? favorites[0] : roots.find(r => r.available)?.path;
          if (target) navigateTo(target);
        }
        break;
      case 'trash':
        setCurrentPath('');
        setShowingTrash(true);
        setShowingSettings(false);
        setShowingJobs(false);
        setViewMode((prev) => prev === 'columns' ? 'list' : prev);
        break;
      case 'jobs':
        setShowingJobs(true);
        setShowingSettings(false);
        setShowingTrash(false);
        setSelectedDriveName(null);
        break;
      case 'settings':
        setShowingSettings(true);
        setShowingTrash(false);
        setShowingJobs(false);
        setSelectedDriveName(null);
        break;
    }
  };

  useEffect(() => {
    getSession()
      .then((value) => setSession(value))
      .catch((err: Error) => setError(err.message))
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    getRoots()
      .then((response) => {
        setRoots(response.roots ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }, [session, sessionLoading]);

  const loadDevices = useCallback(() => {
    setDeviceError(null);
    getDevices()
      .then((response) => {
        setDevices(response.devices ?? []);
      })
      .catch((err: Error) => setDeviceError(err.message));
  }, []);

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    loadDevices();
  }, [session, sessionLoading, loadDevices]);

  useEffect(() => {
    if (!currentPath) {
      return;
    }
    setLoading(true);
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setRenaming(null);
    setContextMenu(null);
    getFiles(currentPath, showHidden)
      .then((response) => {
        setEntries(response.entries ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentPath, refreshKey, showHidden]);

  useEffect(() => {
    if (!renaming) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renaming]);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const subdirs = useMemo(() =>
    entries.filter((e) => e.type === 'directory').slice(0, 20),
    [entries]
  );
  const pollingPath = useRef<string | null>(null);

  useEffect(() => {
    if (!currentPath || loading) {
      pollingPath.current = null;
      return;
    }

    if (pollingPath.current === currentPath) return;

    const hasPendingDir = entriesRef.current.some((e) => e.type === 'directory' && e.size === 0);
    if (!hasPendingDir) {
      pollingPath.current = null;
      return;
    }

    pollingPath.current = currentPath;

    const interval = setInterval(async () => {
      try {
        const response = await getDirSizes(currentPath);
        const sizes = response.sizes ?? {};
        setEntries((prev) => {
          let changed = false;
          const next = prev.map((e) => {
            if (sizes[e.path] !== undefined && e.size !== sizes[e.path]) {
              changed = true;
              return { ...e, size: sizes[e.path] };
            }
            return e;
          });
          if (!changed) return prev;
          const allDone = !next.some((e) => e.type === 'directory' && e.size === 0);
          if (allDone && pollingPath.current === currentPath) {
            pollingPath.current = null;
          }
          return next;
        });
      } catch (e) {
        console.error('Dir sizes polling failed:', e);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (pollingPath.current === currentPath) {
        pollingPath.current = null;
      }
    };
  }, [currentPath, loading]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const handleBreadcrumbBack = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      setCurrentPath('');
    } else {
      setCurrentPath('/' + parts.slice(0, -1).join('/'));
    }
  };

  const persistFavorites = (items: string[]) => {
    setFavorites(items);
    localStorage.setItem('volum_favorites', JSON.stringify(items));
  };

  const addFavorite = (path: string) => {
    if (!favorites.includes(path)) {
      persistFavorites([...favorites, path]);
    }
  };

  const removeFavorite = (path: string) => {
    persistFavorites(favorites.filter((f) => f !== path));
  };

  const toggleSection = (section: string) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem('volum_sectionCollapsed', JSON.stringify(next));
      return next;
    });
  };

  const pushRecent = (path: string) => {
    const next = [path, ...recentPaths.filter((p) => p !== path)].slice(0, 10);
    setRecentPaths(next);
    localStorage.setItem('volum_recent', JSON.stringify(next));
  };

  const handleGlobalSearch = (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    searchFiles(searchQuery.trim(), 20)
      .then((response) => setSearchResults(response.results ?? []))
      .catch(() => setSearchResults([]));
  };

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (activeView === 'files') {
          setLocationMode((v) => !v);
        }
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchResults(null);
        setQuery('');
      }
      if (e.key === 'Escape' && shortcutsOpen) {
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, shortcutsOpen, activeView]);

  const navigateTo = (path: string) => {
    pushRecent(path);
    setCurrentPath(path);
    setShowingJobs(false);
    localStorage.setItem('volum_currentPath', path);
    setSearchOpen(false);
    setSearchResults(null);
    setQuery('');
    setSelectedDriveName(null);
  };

  const isFavorited = favorites.includes(currentPath);
  const folderSuggestions = useMemo(
    () => uniquePaths([
      currentPath,
      ...roots.map((root) => root.path),
      ...devices.flatMap((d) => (d.partitions ?? []).filter((p) => p.volumPath).map((p) => p.volumPath!)),
      ...favorites,
      ...recentPaths
    ]),
    [currentPath, favorites, recentPaths, roots, devices]
  );

  const dismissToast = (id: number) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  };

  const showToast = (toast: Omit<Toast, 'id'>, timeout = 4000) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((items) => [...items.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismissToast(id), timeout);
  };

  const runAction = async (action: () => Promise<unknown>, successTitle?: string) => {
    try {
      await action();
      setError(null);
      if (successTitle) {
        showToast({ title: successTitle, variant: 'success' });
      }
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      showToast({ title: 'Action failed', message, variant: 'error' });
    }
  };

  const handleCreateFolder = () => {
    setContextMenu(null);
    setTextInputDialog({
      title: 'New Folder',
      label: 'Folder name',
      placeholder: 'Folder name',
      confirmLabel: 'Create',
      onSubmit: (value) => {
        void runAction(() => createFolder(currentPath, value.trim()), 'Folder created');
      }
    });
  };

  const handleRename = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) {
      return;
    }
    setContextMenu(null);
    setSelectedPaths([entry.path]);
    setLastSelectedPath(entry.path);
    setRenaming({ path: entry.path, value: entry.name });
  };

  const cancelRename = () => {
    setRenaming(null);
  };

  const commitRename = (entry: FileEntry) => {
    if (renaming?.path !== entry.path) {
      return;
    }
    const nextName = renaming.value.trim();
    if (!nextName || nextName === entry.name) {
      cancelRename();
      return;
    }
    const oldName = entry.name;
    const oldPath = entry.path;
    setRenaming(null);
    void runAction(() => renamePath(oldPath, nextName), 'Item renamed');
    showToast({
      title: 'Item renamed',
      message: `${oldName} → ${nextName}`,
      variant: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          const newPath = joinPath(oldPath.substring(0, oldPath.lastIndexOf('/')), nextName);
          void runAction(() => renamePath(newPath, oldName), 'Rename undone');
        }
      }
    }, 8000);
  };

  const handleDelete = () => {
    if (selectedEntries.length === 0) {
      return;
    }
    const entriesToDelete = [...selectedEntries];
    const label =
      entriesToDelete.length === 1
        ? `"${entriesToDelete[0].name}"`
        : `${entriesToDelete.length} selected items`;
    setConfirmDialog({
      title: 'Move to Trash',
      message: `Move ${label} to trash? You can restore it from the Trash panel.`,
      confirmLabel: 'Move to Trash',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          for (const entry of entriesToDelete) {
            await deletePath(entry.path, entry.name);
          }
          const response = await getTrash();
          setTrashEntries(response.entries ?? []);
        }, 'Moved to trash');
      }
    });
  };

  const handleRestoreTrash = (entry: TrashEntry) => {
    void runAction(async () => {
      await restoreTrash(entry.id);
      const response = await getTrash();
      setTrashEntries(response.entries ?? []);
    });
    showToast({
      title: 'Item restored',
      message: entry.originalPath,
      variant: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          void deletePath(entry.originalPath, entry.name);
          getTrash().then((r) => setTrashEntries(r.entries ?? []));
          showToast({ title: 'Restore undone', variant: 'success' });
        }
      }
    }, 8000);
  };

  const handleDeleteTrash = (entry: TrashEntry) => {
    setTrashContextMenu(null);
    setConfirmDialog({
      title: 'Delete Permanently',
      message: `Permanently delete "${entry.name}"? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          await deleteTrash(entry.id);
          const response = await getTrash();
          setTrashEntries(response.entries ?? []);
        }, 'Item deleted permanently');
      }
    });
  };

  const handleBulkRestoreTrash = () => {
    const ids = [...selectedTrashIds];
    if (ids.length === 0) return;
    setConfirmDialog({
      title: 'Restore Items',
      message: `Restore ${ids.length} item${ids.length === 1 ? '' : 's'} to their original locations?`,
      confirmLabel: 'Restore',
      onConfirm: () => {
        void runAction(async () => {
          for (const id of ids) {
            await restoreTrash(id);
          }
          setSelectedTrashIds([]);
          const response = await getTrash();
          setTrashEntries(response.entries ?? []);
        }, `${ids.length} item${ids.length === 1 ? '' : 's'} restored`);
      }
    });
  };

  const handleBulkDeleteTrash = () => {
    const ids = [...selectedTrashIds];
    if (ids.length === 0) return;
    setConfirmDialog({
      title: 'Delete Permanently',
      message: `Permanently delete ${ids.length} item${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          for (const id of ids) {
            await deleteTrash(id);
          }
          setSelectedTrashIds([]);
          const response = await getTrash();
          setTrashEntries(response.entries ?? []);
        }, `${ids.length} item${ids.length === 1 ? '' : 's'} deleted permanently`);
      }
    });
  };

  const handleSelectTrashItem = (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
    setTrashContextMenu(null);
    if (event.shiftKey && lastSelectedTrashId) {
      const allEntries = trashEntries;
      const from = allEntries.findIndex((e) => e.id === lastSelectedTrashId);
      const to = allEntries.findIndex((e) => e.id === entry.id);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelectedTrashIds(allEntries.slice(start, end + 1).map((e) => e.id));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedTrashIds((prev) =>
        prev.includes(entry.id)
          ? prev.filter((id) => id !== entry.id)
          : [...prev, entry.id]
      );
      setLastSelectedTrashId(entry.id);
      return;
    }
    if (selectedTrashIds.includes(entry.id) && selectedTrashIds.length === 1) {
      setSelectedTrashIds([]);
      setLastSelectedTrashId(null);
      return;
    }
    setSelectedTrashIds([entry.id]);
    setLastSelectedTrashId(entry.id);
  };

  const handleTrashContextMenu = (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (!selectedTrashIds.includes(entry.id)) {
      setSelectedTrashIds([entry.id]);
      setLastSelectedTrashId(entry.id);
    }
    setTrashContextMenu({ x: event.clientX, y: event.clientY, entry });
  };

  const handleDownload = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) {
      return;
    }
    window.location.href = downloadUrl(entry.path);
  };

  const handlePreview = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry || entry.type !== 'file') {
      return;
    }
    const ext = entry.name.toLowerCase();
    if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext)) {
      setPreviewEntry(entry);
    } else {
      window.open(downloadUrl(entry.path), '_blank');
    }
  };

  const handleShowInfo = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) {
      return;
    }
    setContextMenu(null);
    setInfoEntry(entry);
  };

  const handleBatchRename = () => {
    setBatchRenameOpen(true);
  };

  const handleUploadFiles = (files: FileList | File[]) => {
    if (!canWrite) {
      return;
    }
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0 || !currentPath) {
      return;
    }
    void runAction(async () => {
      await uploadFiles(currentPath, selectedFiles);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, `${selectedFiles.length} upload${selectedFiles.length === 1 ? '' : 's'} started`);
  };

  const handleLoggedIn = (nextSession: Session) => {
    setSession(nextSession);
    refresh();
  };

  const handleLogout = () => {
    void logout().then((nextSession) => {
      setSession(nextSession);
      setRoots([]);
      setCurrentPath('');
      setEntries([]);
      setTrashEntries([]);
      setJobs([]);
    });
  };

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    getTrash()
      .then((response) => setTrashEntries(response.entries ?? []))
      .catch((err) => console.error('Failed to fetch trash:', err));
  }, [session, sessionLoading, refreshKey]);

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    getJobs()
      .then((response) => {
        const initialJobs = response.jobs ?? [];
        knownJobIds.current = new Set(initialJobs.map((j) => j.id));
        jobStatuses.current = new Map(initialJobs.map((j) => [j.id, j.status]));
        setJobs(initialJobs);
      })
      .catch((err) => console.error('Failed to fetch jobs:', err));

    const events = new EventSource('/api/jobs/events');
    setSseConnected(true);
    events.addEventListener('jobs', (event) => {
      setSseConnected(true);
      const response = JSON.parse((event as MessageEvent).data) as { jobs: Job[] | null };
      const nextJobs = response.jobs ?? [];

      for (const job of nextJobs) {
        const previousStatus = jobStatuses.current.get(job.id);
        if (job.status === 'completed' && previousStatus !== 'completed' && refreshesFiles(job)) {
          refresh();
        }
        if (!knownJobIds.current.has(job.id) && Notification.permission === 'granted') {
          if (job.status === 'completed') {
            new Notification('Job completed', { body: `[${job.type}] ${job.sourcePath ?? job.id}` });
          } else if (job.status === 'failed') {
            new Notification('Job failed', { body: `[${job.type}] ${job.errorMessage ?? job.id}` });
          }
        }
      }

      knownJobIds.current = new Set(nextJobs.map((j) => j.id));
      jobStatuses.current = new Map(nextJobs.map((j) => [j.id, j.status]));
      setJobs(nextJobs);
    });
    events.onerror = () => {
      setSseConnected(false);
      console.warn('SSE connection lost, will auto-reconnect');
    };
    return () => events.close();
  }, [session, sessionLoading]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? entries.filter((entry) => entry.name.toLowerCase().includes(needle))
      : entries;

    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'size') {
        return (a.size - b.size) * direction;
      }
      if (sortField === 'modifiedAt') {
        return (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()) * direction;
      }
      const aValue = sortField === 'type' ? a.type : a.name;
      const bValue = sortField === 'type' ? b.type : b.name;
      return aValue.localeCompare(bValue) * direction;
    });
  }, [entries, query, sortDirection, sortField]);

  const selectedEntries = useMemo(
    () => filteredEntries.filter((entry) => selectedPaths.includes(entry.path)),
    [filteredEntries, selectedPaths]
  );

  const sortedTrashEntries = useMemo(() => {
    return [...trashEntries].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortField === 'size') return (a.size - b.size) * dir;
      if (sortField === 'type') return a.type.localeCompare(b.type) * dir;
      const dateA = new Date(a.deletedAt).getTime();
      const dateB = new Date(b.deletedAt).getTime();
      return (dateA - dateB) * dir;
    });
  }, [trashEntries, sortField, sortDirection]);

  const canRename = selectedEntries.length === 1;
  const canDownload = selectedEntries.length === 1;
  const canDelete = selectedEntries.length > 0;
  const canCopy = selectedEntries.length > 0;
  const canMove = selectedEntries.length > 0;
  const canInfo = selectedEntries.length === 1;
  const canPreview = selectedEntries.length === 1 && selectedEntries[0].type === 'file';
  const canArchive = selectedEntries.length === 1;
  const canExtract = selectedEntries.length === 1 && selectedEntries[0].type === 'file' && isArchiveFile(selectedEntries[0].name);
  const canChecksum = canWrite && selectedEntries.length === 1;
  const canSelect = filteredEntries.length > 0;
  const canPaste = canWrite && !!fileClipboard && fileClipboard.entries.length > 0;

  const currentRoot = useMemo(() => {
    if (!currentPath) return null;
    return roots.find((r) => currentPath.startsWith(r.path)) ?? null;
  }, [currentPath, roots]);

  const selectedFileBytes = useMemo(() => {
    let total = 0;
    selectedEntries.forEach((entry) => {
      if (entry.size) total += entry.size;
    });
    return total;
  }, [selectedEntries]);

  const showStatusBar = activeView !== 'settings' && activeView !== 'jobs';

  const handleSelectAll = () => {
    const nextPaths = filteredEntries.map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
  };

  const handleInvertSelection = () => {
    const nextPaths = filteredEntries
      .filter((entry) => !selectedPaths.includes(entry.path))
      .map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
  };

  const handleCopy = () => {
    if (!canCopy) {
      return;
    }
    setContextMenu(null);
    setTransferDialog({
      mode: 'copy',
      entries: [...selectedEntries],
      initialDestination: currentPath
    });
  };

  const setClipboardFromSelection = (mode: 'copy' | 'move') => {
    if (!canWrite || selectedEntries.length === 0) {
      return;
    }
    const entriesToStore = [...selectedEntries];
    setFileClipboard({ mode, entries: entriesToStore });
    showToast({
      title: mode === 'copy' ? 'Copied to clipboard' : 'Cut to clipboard',
      message: `${entriesToStore.length} item${entriesToStore.length === 1 ? '' : 's'}`,
      variant: 'success'
    });
  };

  const handleMove = () => {
    if (!canMove) {
      return;
    }
    setContextMenu(null);
    setTransferDialog({
      mode: 'move',
      entries: [...selectedEntries],
      initialDestination: currentPath
    });
  };

  const handleCreateArchiveWithPreview = (entry: FileEntry, targetPath: string, archiveName: string) => {
    getFiles(currentPath, false).then((response) => {
      const entries = response.entries ?? [];
      const conflict = entries.find((e) => e.name === archiveName);
      if (conflict) {
        setConfirmDialog({
          title: 'Archive Already Exists',
          message: `"${archiveName}" already exists in ${currentPath}. Overwrite it?`,
          confirmLabel: 'Overwrite',
          danger: true,
          onConfirm: () => {
            void runAction(() => createArchiveJob(entry.path, targetPath, 'overwrite'), 'Archive job started');
          }
        });
      } else {
        void runAction(() => createArchiveJob(entry.path, targetPath, 'rename'), 'Archive job started');
      }
    }).catch(() => {
      void runAction(() => createArchiveJob(entry.path, targetPath, 'rename'), 'Archive job started');
    });
  };

  const handleCreateArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) {
      return;
    }
    const archiveName = archiveFileName(entry.name);
    const defaultPath = joinPath(currentPath, archiveName);
    setContextMenu(null);
    setTextInputDialog({
      title: 'Create Archive',
      label: 'Archive path',
      initialValue: defaultPath,
      placeholder: defaultPath,
      confirmLabel: 'Create Archive',
      folderSuggestions,
      suggestionLabel: 'Create in',
      applyFolderSuggestion: (path) => joinPath(path, archiveName),
      onSubmit: (value) => {
        handleCreateArchiveWithPreview(entry, value.trim(), archiveName);
      }
    });
  };

  const handleExtractArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1 || entry.type !== 'file' || !isArchiveFile(entry.name)) {
      return;
    }
    const defaultPath = joinPath(currentPath, archiveBaseName(entry.name));
    setContextMenu(null);
    setTextInputDialog({
      title: 'Extract Archive',
      label: 'Destination folder path',
      initialValue: defaultPath,
      placeholder: defaultPath,
      confirmLabel: 'Extract',
      folderSuggestions,
      suggestionLabel: 'Extract to',
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
              onConfirm: () => {
                void runAction(() => createExtractJob(entry.path, dest), 'Extract job started');
              }
            });
          } else {
            void runAction(() => createExtractJob(entry.path, dest), 'Extract job started');
          }
        }).catch(() => {
          void runAction(() => createExtractJob(entry.path, dest), 'Extract job started');
        });
      }
    });
  };

  const handleCreateChecksum = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) {
      return;
    }
    setContextMenu(null);
    setTextInputDialog({
      title: 'Generate Checksum',
      label: 'Verify mode',
      initialValue: 'sha256',
      placeholder: 'sha256',
      confirmLabel: 'Generate',
      onSubmit: (value) => {
        const mode = value.trim().toLowerCase() === 'md5' ? 'md5' : 'sha256';
        void runAction(() => createChecksumJob(entry.path, mode), `Checksum (${mode}) job started`);
      }
    });
  };

  const handlePaste = () => {
    if (!fileClipboard || !canWrite) {
      return;
    }
    setContextMenu(null);
    setTransferDialog({
      mode: fileClipboard.mode,
      entries: [...fileClipboard.entries],
      initialDestination: currentPath
    });
  };

  const handleQuickShare = async () => {
    const entry = contextMenu?.entry;
    if (!entry) return;
    setContextMenu(null);
    try {
      const share = await createShare({ path: entry.path });
      const url = `${window.location.origin}/api/public/${share.token}`;
      await navigator.clipboard.writeText(url);
      showToast({ title: 'Share link copied to clipboard', variant: 'success' });
    } catch (err) {
      showToast({ title: 'Quick share failed', message: err instanceof Error ? err.message : undefined, variant: 'error' });
    }
  };

  const handleTransferSubmit = (dialog: TransferDialogState, destinationValue: string, conflictPolicy: ConflictPolicy) => {
    if (!dialog) {
      return;
    }
    const destinations = destinationValue.split('|').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
    if (destinations.length === 0) {
      return;
    }
    setTransferDialog(null);
    void runAction(async () => {
      for (const entry of dialog.entries) {
        for (const dest of destinations) {
          const targetPath = joinPath(dest, entry.name);
          if (dialog.mode === 'copy') {
            await createCopyJob(entry.path, targetPath, conflictPolicy);
          } else {
            await createMoveJob(entry.path, targetPath, conflictPolicy);
          }
        }
      }
      if (dialog.mode === 'move') {
        setFileClipboard(null);
      }
    }, dialog.mode === 'copy' ? 'Copy job started' : 'Move job started');
  };

  const handleCancelJob = (id: string) => {
    void runAction(async () => {
      await cancelJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Job cancelled');
  };

  const handleRetryJob = (id: string) => {
    void runAction(async () => {
      await retryJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Job retried');
  };

  const handleRetryItem = (jobId: string, itemId: string) => {
    void runAction(async () => {
      await retryJobItem(jobId, itemId);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Item queued for retry');
  };

  const handlePauseJob = (id: string) => {
    void runAction(async () => {
      await pauseJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Job paused');
  };

  const handleResumeJob = (id: string) => {
    void runAction(async () => {
      await resumeJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Job resumed');
  };

  const handleClearCompleted = () => {
    void runAction(async () => {
      const result = await clearCompletedJobs();
      const response = await getJobs();
      setJobs(response.jobs ?? []);
      return result;
    }, 'Completed jobs cleared');
  };

  const handleClearFailed = () => {
    void runAction(async () => {
      const result = await clearFailedJobs();
      const response = await getJobs();
      setJobs(response.jobs ?? []);
      return result;
    }, 'Failed jobs cleared');
  };

  const handleSelectEntry = (entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    if (renaming) {
      return;
    }
    setContextMenu(null);

    if (event.shiftKey && lastSelectedPath) {
      const from = filteredEntries.findIndex((item) => item.path === lastSelectedPath);
      const to = filteredEntries.findIndex((item) => item.path === entry.path);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelectedPaths(filteredEntries.slice(start, end + 1).map((item) => item.path));
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      if (selectedPaths.includes(entry.path)) {
        const nextPaths = selectedPaths.filter((path) => path !== entry.path);
        setSelectedPaths(nextPaths);
        setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
      } else {
        setSelectedPaths([...selectedPaths, entry.path]);
        setLastSelectedPath(entry.path);
      }
      return;
    }

    if (selectedPaths.includes(entry.path)) {
      setSelectedPaths((paths) => paths.filter((path) => path !== entry.path));
      setLastSelectedPath(null);
      return;
    }

    setSelectedPaths([entry.path]);
    setLastSelectedPath(entry.path);
  };

  const handleContextMenu = (entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (renaming) {
      return;
    }
    if (!selectedPaths.includes(entry.path)) {
      setSelectedPaths([entry.path]);
      setLastSelectedPath(entry.path);
    }
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  };

  const handleFileAreaKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (renaming) {
      if (event.key === 'Escape') {
        cancelRename();
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      handleSelectAll();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      setClipboardFromSelection('copy');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      setClipboardFromSelection('move');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      handlePaste();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      handleInvertSelection();
      return;
    }
    if (event.key === 'F2' && canWrite && canRename) {
      event.preventDefault();
      handleRename();
      return;
    }
    if (event.key === 'Delete' && canWrite && canDelete) {
      event.preventDefault();
      handleDelete();
      return;
    }
    if (event.key === 'Escape') {
      setSelectedPaths([]);
      setContextMenu(null);
      setLastSelectedPath(null);
      return;
    }
    if (event.key === 'Enter' && selectedEntries.length === 1) {
      if (selectedEntries[0].type === 'directory') {
        navigateTo(selectedEntries[0].path);
      } else {
        handlePreview();
      }
    }
  };

  const handleFileAreaClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setRenaming(null);
    setContextMenu(null);
  };

  const handleFileAreaMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    rubberBand.current = {
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      endX: event.clientX - rect.left,
      endY: event.clientY - rect.top,
      active: true,
    };
    setRubberBandStyle({
      left: rubberBand.current.startX,
      top: rubberBand.current.startY,
      width: 0,
      height: 0,
    });
    setSelectedPaths([]);
    setLastSelectedPath(null);

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!rubberBand.current.active) return;
      const rect2 = event.currentTarget.getBoundingClientRect();
      const endX = e.clientX - rect2.left;
      const endY = e.clientY - rect2.top;
      rubberBand.current.endX = endX;
      rubberBand.current.endY = endY;

      const left = Math.min(rubberBand.current.startX, endX);
      const top = Math.min(rubberBand.current.startY, endY);
      const width = Math.abs(endX - rubberBand.current.startX);
      const height = Math.abs(endY - rubberBand.current.startY);
      setRubberBandStyle({ left, top, width, height });

      const gridRects = fileGridRef.current?.querySelectorAll('[data-index]');
      if (!gridRects) return;
      const bandRect = { left, top, right: left + width, bottom: top + height };
      const selected: string[] = [];
      gridRects.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const elBandRect = { left: elRect.left - rect2.left, top: elRect.top - rect2.top, right: elRect.right - rect2.left, bottom: elRect.bottom - rect2.top };
        if (elBandRect.left < bandRect.right && elBandRect.right > bandRect.left &&
            elBandRect.top < bandRect.bottom && elBandRect.bottom > bandRect.top) {
          const idx = Number((el as HTMLElement).dataset.index);
          if (idx >= 0 && idx < filteredEntries.length) {
            selected.push(filteredEntries[idx].path);
          }
        }
      });
      setSelectedPaths(selected);
      if (selected.length > 0) {
        setLastSelectedPath(selected[selected.length - 1]);
      }
    };

    const handleMouseUp = () => {
      rubberBand.current.active = false;
      setRubberBandStyle(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleWorkspaceClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setRenaming(null);
    setContextMenu(null);
  };

  const handleFileDragStart = (event: DragEvent<HTMLElement>, entry: FileEntry) => {
    const paths = selectedPaths.length > 0 ? selectedPaths : [entry.path];
    setDraggingPaths(paths);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', paths.join('\n'));
  };

  const handleFolderDragOver = (event: DragEvent<HTMLElement>, path: string) => {
    if (draggingPaths || event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverPath(path);
    }
  };

  const handleFolderDragLeave = () => {
    setDragOverPath(null);
  };

  const handleDropOnFolder = (event: DragEvent<HTMLElement>, folderPath: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverPath(null);
    setDraggingUpload(false);
    if (draggingPaths && draggingPaths.length > 0) {
      const sourceEntries = draggingPaths.map((p) => {
        const found = filteredEntries.find((e) => e.path === p);
        return found || { name: p.split('/').pop() || p, path: p, type: 'file' as const, size: 0, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false };
      }).filter(Boolean);
      if (sourceEntries.length > 0) {
        setTransferDialog({
          mode: draggingPaths === selectedPaths ? 'move' : 'copy',
          entries: sourceEntries,
          initialDestination: folderPath,
        });
      }
      setDraggingPaths(null);
      return;
    }
    if (canWrite && event.dataTransfer.files.length > 0) {
      handleUploadFiles(event.dataTransfer.files);
      return;
    }
  };

  const handleFileAreaDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (canWrite && event.dataTransfer.types.includes('Files')) {
      setDraggingUpload(true);
    }
  };

  const handleFileAreaDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDraggingUpload(false);
    }
  };

  const handleFileAreaDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDraggingUpload(false);
    if (!canWrite) {
      return;
    }
    handleUploadFiles(event.dataTransfer.files);
  };

  useEffect(() => {
    const closeContextMenu = () => { setContextMenu(null); setTrashContextMenu(null); };
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('resize', closeContextMenu);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, []);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) {
      return [];
    }
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((part, index) => ({
      label: part,
      path: `/${parts.slice(0, index + 1).join('/')}`
    }));
  }, [currentPath]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('volum_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('volum_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!showingTrash && viewModeBeforeTrash.current) {
      setViewMode(viewModeBeforeTrash.current);
      viewModeBeforeTrash.current = null;
    }
  }, [showingTrash]);

  useEffect(() => {
    localStorage.setItem('volum_sortField', sortField);
    localStorage.setItem('volum_sortDirection', sortDirection);
  }, [sortField, sortDirection]);

  useEffect(() => {
    localStorage.setItem('volum_showHidden', String(showHidden));
  }, [showHidden]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  if (sessionLoading) {
    return <div className={styles.authShell}>Loading...</div>;
  }

  if (session?.authEnabled && !session.authenticated) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />;
  }

  const handleEntryTouchStart = (entry: FileEntry, event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    longPressEntry.current = { entry, x: touch.clientX, y: touch.clientY };
    const timer = window.setTimeout(() => {
      const lp = longPressEntry.current;
      if (lp) {
        setContextMenu({ x: lp.x, y: lp.y, entry: lp.entry });
        longPressEntry.current = null;
      }
    }, 500);
    longPressTimerRef.current = timer;
  };

  const handleEntryTouchMove = () => {
    longPressEntry.current = null;
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const handleEntryTouchEnd = () => {
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const handleDesktopNavigateToTrash = () => {
    setCurrentPath('');
    setShowingTrash(true);
    setShowingSettings(false);
    setShowingJobs(false);
    setSelectedPaths([]);
    setSelectedDriveName(null);
    if (viewMode === 'columns') { viewModeBeforeTrash.current = viewMode; }
    setViewMode((prev) => prev === 'columns' ? 'list' : prev);
  };

  const shell = (
    <>
      <main className={styles.appShell}>
        <TopBar
          activeView={activeView}
          onGoDesktop={() => { setCurrentPath(''); setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setSelectedDriveName(null); }}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onOpenSettings={() => setShowingSettings(true)}
          onLogout={handleLogout}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          session={session}
        />
        <Dock items={dockItems} onActivate={handleDockActivate} />

        <section className={styles.workspace} onClick={handleWorkspaceClick}>
        {activeView === 'files' && selectedEntries.length > 0 ? (
            <header className={styles.topbar}>
            <div className={styles.selectionBar}>
              <span>{selectedEntries.length} selected</span>
              <div className={styles.selectionActions}>
                <button type="button" onClick={handleSelectAll} disabled={!canSelect}>
                  <Icon name="selection-select-all" size={16} />
                  Select all
                </button>
                <button type="button" onClick={handleInvertSelection} disabled={!canSelect}>
                  <Icon name="selection-invert" size={16} />
                  Invert
                </button>
                {canPreview && (
                  <button type="button" onClick={handlePreview}>
                    <Icon name="view-preview" size={16} />
                    Preview
                  </button>
                )}
                {canInfo && (
                  <button type="button" onClick={handleShowInfo}>
                    <Icon name="dialog-information" size={16} />
                    Info
                  </button>
                )}
                {canDownload && (
                  <button type="button" onClick={handleDownload}>
                    <Icon name="edit-download" size={16} />
                    Download
                  </button>
                )}
                {canRename && canWrite && (
                  <button type="button" onClick={handleRename}>
                    <Icon name="edit-rename" size={16} />
                    Rename
                  </button>
                )}
                {canWrite && selectedEntries.length > 1 && (
                  <button type="button" onClick={handleBatchRename}>
                    <Icon name="edit-rename" size={16} />
                    Batch rename
                  </button>
                )}
                {canCopy && canWrite && (
                  <button type="button" onClick={handleCopy}>
                    <Icon name="edit-copy" size={16} />
                    Copy
                  </button>
                )}
                {canMove && canWrite && (
                  <button type="button" onClick={handleMove}>
                    <Icon name="edit-cut" size={16} />
                    Move
                  </button>
                )}
                {canArchive && canWrite && (
                  <button type="button" onClick={handleCreateArchive}>
                    <Icon name="archive-create" size={16} />
                    Archive
                  </button>
                )}
                {canExtract && canWrite && (
                  <button type="button" onClick={handleExtractArchive}>
                    <Icon name="archive-extract" size={16} />
                    Extract
                  </button>
                )}
                {canChecksum && (
                  <button type="button" onClick={handleCreateChecksum}>
                    <Icon name="view-refresh" size={16} />
                    Checksum
                  </button>
                )}
                {canWrite && (
                  <button type="button" onClick={handlePaste} disabled={!canPaste}>
                    <Icon name="edit-paste" size={16} />
                    Paste
                  </button>
                )}
                {canDelete && canWrite && (
                  <button type="button" onClick={handleDelete} className={styles.danger}>
                    <Icon name="edit-delete" size={16} />
                    Delete
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setSelectedPaths([])}>
                Clear
              </button>
            </div>
            </header>
          ) : null}

        {activeView === 'desktop' && (
          <DesktopView
            devices={devices}
            trashEntries={trashEntries}
            jobs={jobs}
            selectedDriveName={selectedDriveName}
            onNavigateTo={navigateTo}
            onNavigateToTrash={handleDesktopNavigateToTrash}
            onOpenSettings={() => { setShowingSettings(true); setShowingTrash(false); setSelectedDriveName(null); }}
            onOpenJobs={() => { setShowingJobs(true); setShowingSettings(false); setShowingTrash(false); setSelectedDriveName(null); }}
            onSelectDrive={setSelectedDriveName}
            viewMode={viewMode}
            onSetViewMode={setViewMode}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            session={session}
            onLogout={handleLogout}
            deviceError={deviceError}
            onRetryDevices={loadDevices}
          />
        )}
        {activeView === 'trash' && (
          <TrashView
            trashEntries={trashEntries}
            selectedTrashIds={selectedTrashIds}
            onSelectTrash={handleSelectTrashItem}
            onSelectAllTrash={() => {
              setSelectedTrashIds(trashEntries.map((e) => e.id));
              setLastSelectedTrashId(trashEntries.length > 0 ? trashEntries[trashEntries.length - 1].id : null);
            }}
            onInvertSelectionTrash={() => {
              const allIds = trashEntries.map((e) => e.id);
              setSelectedTrashIds(allIds.filter((id) => !selectedTrashIds.includes(id)));
              setLastSelectedTrashId(null);
            }}
            onClearSelectionTrash={() => setSelectedTrashIds([])}
            onBulkRestoreTrash={handleBulkRestoreTrash}
            onBulkDeleteTrash={handleBulkDeleteTrash}
            onCloseTrash={() => setShowingTrash(false)}
            onRefreshTrash={() => { getTrash().then(r => setTrashEntries(r.entries ?? [])); }}
            viewMode={viewMode}
            onCycleViewMode={() => setViewMode(cycleViewMode)}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(value) => {
              const [field, direction] = value.split(':') as [SortField, SortDirection];
              setSortField(field);
              setSortDirection(direction);
            }}
            canWrite={canWrite}
            sortedTrashEntries={sortedTrashEntries}
            onTrashContextMenu={handleTrashContextMenu}
          />
        )}
        {activeView === 'files' && (
          <FilesView
            currentPath={currentPath}
            breadcrumbs={breadcrumbs}
            onNavigate={navigateTo}
            onGoUp={() => setCurrentPath('')}
            onRefresh={refresh}
            entries={entries}
            filteredEntries={filteredEntries}
            selectedPaths={selectedPaths}
            onSelectEntry={handleSelectEntry}
            onSelectAll={handleSelectAll}
            onInvertSelection={handleInvertSelection}
            viewMode={viewMode}
            onSetViewMode={setViewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(value) => {
              const [field, direction] = value.split(':') as [SortField, SortDirection];
              setSortField(field);
              setSortDirection(direction);
            }}
            showHidden={showHidden}
            onToggleHidden={() => setShowHidden((v) => !v)}
            loading={loading}
            error={error}
            sseConnected={sseConnected}
            onDismissError={() => setError(null)}
            canWrite={canWrite}
            isFavorited={isFavorited}
            onToggleFavorite={() => isFavorited ? removeFavorite(currentPath) : addFavorite(currentPath)}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            session={session}
            onLogout={handleLogout}
            query={query}
            searchOpen={searchOpen}
            searchResults={searchResults}
            onSearch={(q) => {
              setQuery(q);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => handleGlobalSearch(q), 200);
              setSearchOpen(true);
            }}
            onClearSearch={() => { setQuery(''); setSearchResults(null); setSearchOpen(false); }}
            onSearchResultClick={(result) => {
              if (result.type === 'directory') {
                navigateTo(result.path);
              } else {
                const idx = result.path.lastIndexOf('/');
                const parentDir = idx < 0 ? '/' : result.path.substring(0, idx) || '/';
                navigateTo(parentDir || '/');
              }
            }}
            searchRef={searchRef as React.RefObject<HTMLInputElement>}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            onCreateFolder={handleCreateFolder}
            onUpload={handleUploadFiles}
            fileClick={handleFileAreaClick}
            contextMenu={contextMenu}
            onContextMenu={handleContextMenu}
            onCloseContextMenu={() => setContextMenu(null)}
            draggingUpload={draggingUpload}
            onFileAreaDragOver={handleFileAreaDragOver}
            onFileAreaDragLeave={handleFileAreaDragLeave}
            onFileAreaDrop={handleFileAreaDrop}
            onFileAreaMouseDown={handleFileAreaMouseDown}
            onFileAreaKeyDown={handleFileAreaKeyDown}
            onFileDragStart={handleFileDragStart}
            onFolderDragOver={handleFolderDragOver}
            onFolderDragLeave={handleFolderDragLeave}
            onDropOnFolder={handleDropOnFolder}
            dragOverPath={dragOverPath}
            renameState={renaming}
            renameInputRef={renameInputRef as React.RefObject<HTMLInputElement>}
            onSubmitRename={commitRename}
            onCancelRename={cancelRename}
            onRenameChange={(value) => setRenaming({ path: renaming?.path ?? '', value })}
            rubberBandStyle={rubberBandStyle}
            onPreview={(entry) => {
              const ext = entry.name.toLowerCase();
              if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext)) {
                setPreviewEntry(entry);
              } else {
                window.open(downloadUrl(entry.path), '_blank');
              }
            }}
            fileGridRef={fileGridRef as React.RefObject<HTMLDivElement>}
            onEntryTouchStart={handleEntryTouchStart}
            onEntryTouchMove={handleEntryTouchMove}
            onEntryTouchEnd={handleEntryTouchEnd}
            devices={devices}
            favorites={favorites}
            recentPaths={recentPaths}
            subdirs={subdirs}
            sectionCollapsed={sectionCollapsed}
            onToggleSection={toggleSection}
            onRemoveFavorite={removeFavorite}
            locationMode={locationMode}
            onLocationNavigate={(path: string) => {
              const clean = path.startsWith('/') ? path : `/${path}`;
              navigateTo(clean);
            }}
            onToggleLocationMode={() => setLocationMode((v) => !v)}
          />
        )}
        {activeView === 'jobs' && (
          <JobsPage
            jobs={jobs}
            jobFilter={jobFilter}
            setJobFilter={setJobFilter}
            completedCollapsed={completedCollapsed}
            setCompletedCollapsed={setCompletedCollapsed}
            onCancel={handleCancelJob}
            onPause={handlePauseJob}
            onResume={handleResumeJob}
            onRetry={handleRetryJob}
            onClearCompleted={handleClearCompleted}
            onClearFailed={handleClearFailed}
            onClose={() => setShowingJobs(false)}
          />
        )}
        {activeView === 'settings' && (
          <SettingsPanel variant="page" onClose={() => setShowingSettings(false)} onOpenShares={() => { setShowingSettings(false); setSharesOpen(true); }} />
        )}

        {contextMenu && (
          <div
            className={styles.contextMenu}
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 300) }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={handlePreview} disabled={!canPreview}>
              <Icon name="view-preview" size={16} />
              Preview
            </button>
            <button type="button" onClick={handleShowInfo} disabled={!canInfo}>
              <Icon name="dialog-information" size={16} />
              Info
            </button>
            <button type="button" onClick={handleDownload} disabled={!canDownload}>
              <Icon name="edit-download" size={16} />
              Download
            </button>
            <button type="button" onClick={handleRename} disabled={!canWrite || !canRename}>
              <Icon name="edit-rename" size={16} />
              Rename
            </button>
            {canWrite && selectedEntries.length > 1 && (
              <button type="button" onClick={handleBatchRename}>
                <Icon name="edit-rename" size={16} />
                Batch rename
              </button>
            )}
            <button type="button" onClick={handleCopy} disabled={!canWrite || !canCopy}>
              <Icon name="edit-copy" size={16} />
              Copy
            </button>
            <button type="button" onClick={handleMove} disabled={!canWrite || !canMove}>
              <Icon name="edit-cut" size={16} />
              Move
            </button>
            <button type="button" onClick={handleCreateArchive} disabled={!canWrite || !canArchive}>
              <Icon name="archive-create" size={16} />
              Archive
            </button>
            <button type="button" onClick={handleExtractArchive} disabled={!canWrite || !canExtract}>
              <Icon name="archive-extract" size={16} />
              Extract
            </button>
            <button type="button" onClick={handleCreateChecksum} disabled={!canChecksum}>
              <Icon name="view-refresh" size={16} />
              Checksum
            </button>
            <button type="button" onClick={handlePaste} disabled={!canPaste}>
              <Icon name="edit-paste" size={16} />
              Paste
            </button>
            {canWrite && (
              <button type="button" onClick={handleQuickShare}>
                <Icon name="mail-send" size={16} />
                Quick Share
              </button>
            )}
            {canInfo && (
              <button type="button" onClick={() => {
                const entry = contextMenu?.entry;
                if (entry) setShareDialogPath({ path: entry.path, name: entry.name });
              }}>
                <Icon name="mail-send" size={16} />
                Share
              </button>
            )}
            <button type="button" className={styles.danger} onClick={handleDelete} disabled={!canWrite || !canDelete}>
              <Icon name="edit-delete" size={16} />
              Delete
            </button>
          </div>
        )}
        {trashContextMenu && canWrite && (
          <div
            className={styles.contextMenu}
            style={{ left: Math.min(trashContextMenu.x, window.innerWidth - 200), top: Math.min(trashContextMenu.y, window.innerHeight - 300) }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => {
              handleRestoreTrash(trashContextMenu.entry);
              setTrashContextMenu(null);
            }}>
              <Icon name="edit-restore" size={16} />
              Restore
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={() => {
                handleDeleteTrash(trashContextMenu.entry);
              }}
            >
              <Icon name="edit-delete" size={16} />
              Delete permanently
            </button>
          </div>
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

  if (previewEntry) {
    return (
      <>
        {shell}
        <PreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} />
      </>
    );
  }

  if (infoEntry) {
    return (
      <>
        {shell}
        <InfoPanel entry={infoEntry} onClose={() => setInfoEntry(null)} onRefresh={refresh} />
      </>
    );
  }

  if (batchRenameOpen) {
    return (
      <>
        {shell}
        <BatchRenameModal
          entries={selectedEntries}
          onClose={() => setBatchRenameOpen(false)}
          onDone={() => {
            showToast({ title: 'Items renamed', variant: 'success' });
            refresh();
          }}
        />
      </>
    );
  }

  if (confirmDialog) {
    return (
      <>
        {shell}
        <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      </>
    );
  }

  if (textInputDialog) {
    return (
      <>
        {shell}
        <TextInputDialog dialog={textInputDialog} onClose={() => setTextInputDialog(null)} />
      </>
    );
  }

  if (transferDialog) {
    return (
      <>
        {shell}
        <TransferDialog
          dialog={transferDialog}
          folderSuggestions={folderSuggestions}
          onClose={() => setTransferDialog(null)}
          onSubmit={handleTransferSubmit}
        />
      </>
    );
  }

  if (shareDialogPath) {
    return (
      <>
        {shell}
        <ShareDialog path={shareDialogPath.path} name={shareDialogPath.name} onClose={() => setShareDialogPath(null)} />
      </>
    );
  }

  if (shortcutsOpen) {
    return (
      <>
        {shell}
        <Overlay onClose={() => setShortcutsOpen(false)}>
          <div className={styles.shortcutsPanel}>
            <h3>Keyboard Shortcuts</h3>
            <div className={styles.shortcutRow}><span>Navigate into folder / Open file</span><span className={styles.shortcutKey}>Enter</span></div>
            <div className={styles.shortcutRow}><span>Deselect all</span><span className={styles.shortcutKey}>Esc</span></div>
            <div className={styles.shortcutRow}><span>Select all</span><span className={styles.shortcutKey}>⌘A</span></div>
            <div className={styles.shortcutRow}><span>Copy selected items</span><span className={styles.shortcutKey}>⌘C</span></div>
            <div className={styles.shortcutRow}><span>Cut selected items</span><span className={styles.shortcutKey}>⌘X</span></div>
            <div className={styles.shortcutRow}><span>Paste clipboard items</span><span className={styles.shortcutKey}>⌘V</span></div>
            <div className={styles.shortcutRow}><span>Invert selection</span><span className={styles.shortcutKey}>⌘I</span></div>
            <div className={styles.shortcutRow}><span>Global search</span><span className={styles.shortcutKey}>⌘K</span></div>
            <div className={styles.shortcutRow}><span>Toggle shortcuts</span><span className={styles.shortcutKey}>?</span></div>
            <div className={styles.shortcutRow}><span>Rename selected item</span><span className={styles.shortcutKey}>F2</span></div>
            <div className={styles.shortcutRow}><span>Move selected items to trash</span><span className={styles.shortcutKey}>Delete</span></div>
            <div className={styles.shortcutRow}><span>Shift-range select</span><span className={styles.shortcutKey}>⇧+click</span></div>
            <div className={styles.shortcutRow}><span>Multi-select toggle</span><span className={styles.shortcutKey}>⌘+click</span></div>
            <hr />
            <div className={styles.shortcutRow}><span>Close preview / Clear search</span><span className={styles.shortcutKey}>Esc</span></div>
            <div className={styles.shortcutRow}><span>Context menu</span><span className={styles.shortcutKey}>Right click</span></div>
          </div>
    </Overlay>
  </>);
}

if (sharesOpen) {
  return (<>
    {shell}
    <ShareManager onClose={() => setSharesOpen(false)} />
  </>);
}

return shell;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [role, setRole] = useState<'admin' | 'readonly'>('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    login(role, password)
      .then(onLoggedIn)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className={styles.authShell}>
      <form className={styles.loginPanel} onSubmit={handleSubmit}>
        <img className={styles.brandMark} src={appIcon} alt="" />
        <h1>Volum Desktop</h1>
        <Select value={role} onChange={(value) => setRole(value as 'admin' | 'readonly')}>
          <option value="admin">Admin</option>
          <option value="readonly">Readonly</option>
        </Select>
        <input
          autoFocus
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className={styles.loginError}>{error}</p>}
        <button disabled={submitting || password.length === 0} type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}





function formatBytes(value: number) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

function formatDeviceUsage(part: BlockDevice) {
  if (part.totalBytes != null && part.totalBytes > 0) {
    const fsType = part.fsType ? ` · ${part.fsType}` : '';
    return `${formatBytes(part.usedBytes!)} used of ${formatBytes(part.totalBytes)} | ${formatBytes(part.freeBytes!)} free${fsType}`;
  }
  if (part.mountPoint) {
    return 'Usage unavailable';
  }
  return 'Not mounted';
}

function cycleViewMode(current: ViewMode): ViewMode {
  return current === 'list' ? 'grid' : current === 'grid' ? 'columns' : 'list';
}

function formatGridDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTrashPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `.../${parts.slice(-2).join('/')}`;
}

function isArchiveFile(name: string) {
  return /\.(zip|tar|tar\.gz|tgz)$/i.test(name);
}

function archiveBaseName(name: string) {
  return name
    .replace(/\.tar\.gz$/i, '')
    .replace(/\.tgz$/i, '')
    .replace(/\.tar$/i, '')
    .replace(/\.zip$/i, '') || 'archive';
}

function archiveFileName(name: string) {
  return `${archiveBaseName(name)}.zip`;
}

function refreshesFiles(job: Job) {
  return job.type === 'copy' || job.type === 'move' || job.type === 'upload' || job.type === 'archive' || job.type === 'extract';
}

function normalizeFolderPath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function joinPath(parent: string, name: string) {
  return `${normalizeFolderPath(parent).replace(/\/$/, '')}/${name}`.replace(/^\/\//, '/');
}

function uniquePaths(paths: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    const normalized = normalizeFolderPath(path.trim());
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function buildColumnPath(currentPath: string): string[] {
  if (!currentPath || currentPath === '/') {
    return ['/'];
  }
  const parts = currentPath.split('/').filter(Boolean);
  const cols: string[] = [];
  for (let i = 0; i <= parts.length; i++) {
    cols.push('/' + parts.slice(0, i).join('/'));
  }
  return cols;
}
