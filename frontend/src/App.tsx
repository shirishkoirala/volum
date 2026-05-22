import { DragEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, FileIcon, FolderIcon, DeviceIcon, TrashIcon } from './components/Icon';
import {
  ConflictPolicy,
  FileEntry,
  Job,
  SearchResult,
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
  rawUrl,
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
  chmodPath
} from './api/client';
import appIcon from './assets/icon-light.png';
import { PreviewModal } from './components/PreviewModal';
import { BatchRenameModal } from './components/BatchRenameModal';
import { InfoPanel } from './components/InfoPanel';
import { BreadcrumbBar } from './components/BreadcrumbBar';
import { Overlay } from './components/shared';
import { ConfirmDialog, TextInputDialog, TransferDialog, ToastViewport } from './components/Dialogs';
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
  const [currentPath, setCurrentPath] = useState('');
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
  const [showingTrash, setShowingTrash] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const [lastSelectedTrashId, setLastSelectedTrashId] = useState<string | null>(null);
  const [trashContextMenu, setTrashContextMenu] = useState<{
    x: number; y: number; entry: TrashEntry;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileGridRef = useRef<HTMLDivElement>(null);
  const longPressEntry = useRef<{ entry: FileEntry; x: number; y: number } | null>(null);

  const canWrite = session?.role === 'admin';

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
  }, [searchOpen, shortcutsOpen]);

  const navigateTo = (path: string) => {
    pushRecent(path);
    setCurrentPath(path);
    setSearchOpen(false);
    setSearchResults(null);
    setQuery('');
  };

  const isFavorited = favorites.includes(currentPath);
  const folderSuggestions = useMemo(
    () => uniquePaths([
      currentPath,
      ...roots.map((root) => root.path),
      ...favorites,
      ...recentPaths
    ]),
    [currentPath, favorites, recentPaths, roots]
  );

  const dismissToast = (id: number) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  };

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((items) => [...items.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismissToast(id), 4000);
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
    setRenaming(null);
    void runAction(() => renamePath(entry.path, nextName), 'Item renamed');
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
    }, 'Item restored');
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
      .catch(() => undefined);
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
      .catch(() => undefined);

    const events = new EventSource('/api/jobs/events');
    events.addEventListener('jobs', (event) => {
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
    events.onerror = () => undefined;
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
        void runAction(() => createArchiveJob(entry.path, value.trim(), 'rename'), 'Archive job started');
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
        void runAction(() => createExtractJob(entry.path, value.trim()), 'Extract job started');
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

      const gridRects = fileGridRef.current?.querySelectorAll('.file-row');
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

  const shell = (
    <>
      <main className={styles.appShell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <img className={styles.brandMark} src={appIcon} alt="" />
            <div>
              <strong>Volum</strong>
              <span>File manager</span>
              {session?.authEnabled && <span>{session.role}</span>}
            </div>
          </div>

          <section className={styles.navSection}>
            <h2>Storage</h2>
            <div className={styles.rootList}>
              {roots.map((root) => (
                <button
                  className={root.path === currentPath ? `${styles.rootItem} ${styles.active}` : styles.rootItem}
                  key={root.path}
                  onClick={() => navigateTo(root.path)}
                  type="button"
                >
                  <DeviceIcon name="drive-harddisk" size={18} />
                  <span className={styles.rootDetails}>
                    <span>{rootLabel(root)}</span>
                    <small>{root.path}</small>
                    <small>{formatRootUsage(root)}</small>
                    {root.totalBytes > 0 && (
                      <span className={styles.rootMeter} aria-hidden="true">
                        <span style={{ width: `${Math.min((root.usedBytes / root.totalBytes) * 100, 100)}%` }} />
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {favorites.length > 0 && (
            <section className={styles.navSection}>
              <div className={styles.sectionHeading}>
                <h2>Favorites</h2>
              </div>
              <div className={styles.rootList}>
                {favorites.map((path) => (
                  <div
                    className={path === currentPath ? `${styles.rootItem} ${styles.active}` : styles.rootItem}
                    key={path}
                    onClick={() => navigateTo(path)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        navigateTo(path);
                      }
                    }}
                  >
                    <FolderIcon size={18} />
                    <span className={styles.favDetails}>
                      <span>{path.split('/').pop() || path}</span>
                      <small>{path}</small>
                    </span>
                    <button
                      className={styles.favRemove}
                      onClick={(e) => { e.stopPropagation(); removeFavorite(path); }}
                      title="Remove from favorites"
                      type="button"
                    >
                      <Icon name="edit-delete" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recentPaths.length > 0 && (
            <section className={styles.navSection}>
              <div className={styles.sectionHeading}>
                <h2>Recent</h2>
              </div>
              <div className={styles.rootList}>
                {recentPaths.map((path) => (
                  <button
                    className={path === currentPath ? `${styles.rootItem} ${styles.active}` : styles.rootItem}
                    key={path}
                    onClick={() => navigateTo(path)}
                    type="button"
                  >
                    <FolderIcon size={18} />
                    <span className={styles.favDetails}>
                      <span>{path.split('/').pop() || path}</span>
                      <small>{path}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

        </aside>

        <section className={styles.workspace} onClick={handleWorkspaceClick}>
        {selectedEntries.length > 0 ? (
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
                  <button type="button" onClick={handleDelete} className="danger">
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
          ) : (
            <BreadcrumbBar crumbs={breadcrumbs} onBack={handleBreadcrumbBack} onNavigate={navigateTo}>
              <div className={styles.toolbar}>
                <button
                  className="icon-button"
                  disabled={!canWrite}
                  onClick={handleCreateFolder}
                  title="Create folder"
                  type="button"
                >
                  <Icon name="folder-new" size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!canWrite}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload files"
                  type="button"
                >
                  <Icon name="document-import" size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  className={styles.hiddenFileInput}
                  multiple
                  type="file"
                  onChange={(event) => {
                    if (event.currentTarget.files) {
                      handleUploadFiles(event.currentTarget.files);
                      event.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  className="icon-button"
                  disabled={!canSelect}
                  onClick={handleSelectAll}
                  title="Select all"
                  type="button"
                >
                  <Icon name="selection-select-all" size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!canSelect}
                  onClick={handleInvertSelection}
                  title="Invert selection"
                  type="button"
                >
                  <Icon name="selection-invert" size={18} />
                </button>
                <label className={styles.searchBox}>
                  <Icon name="edit-find" size={16} />
                  <input
                    ref={searchRef}
                    placeholder="Search files (Ctrl+K)"
                    value={query}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      handleGlobalSearch(event.target.value);
                      setSearchOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setSearchOpen(false);
                        setSearchResults(null);
                        setQuery('');
                      }
                    }}
                  />
                  {query.length > 0 && (
                    <button type="button" className={styles.searchClear} onClick={() => { setQuery(''); setSearchResults(null); setSearchOpen(false); }}>
                      <Icon name="window-close" size={14} />
                    </button>
                  )}
                </label>
                {searchOpen && searchResults && searchResults.length > 0 && (
                  <div className={styles.searchResultsDropdown}>
                    {searchResults.map((result) => (
                      <button
                        key={result.path}
                        type="button"
                        className={styles.searchResultItem}
                        onClick={() => {
                          if (result.type === 'directory') {
                            navigateTo(result.path);
                          } else {
                            const parentDir = result.path.substring(0, result.path.lastIndexOf('/') || 1);
                            navigateTo(parentDir || '/');
                          }
                        }}
                      >
                        <FileIcon entry={{ ...result, hidden: false, permissions: '', owner: '', group: '' }} size={22} />
                        <span className={styles.searchResultName}>{result.name}</span>
                        <span className={styles.searchResultPath}>{result.root}</span>
                      </button>
                    ))}
                  </div>
                )}
                <select
                  className={styles.sortSelect}
                  value={`${sortField}:${sortDirection}`}
                  onChange={(event) => {
                    const [field, direction] = event.target.value.split(':') as [SortField, SortDirection];
                    setSortField(field);
                    setSortDirection(direction);
                  }}
                  title="Sort files"
                >
                  <option value="name:asc">Name A-Z</option>
                  <option value="name:desc">Name Z-A</option>
                  <option value="size:asc">Size small first</option>
                  <option value="size:desc">Size large first</option>
                  <option value="type:asc">Type A-Z</option>
                  <option value="type:desc">Type Z-A</option>
                  <option value="modifiedAt:desc">Newest first</option>
                  <option value="modifiedAt:asc">Oldest first</option>
                </select>
                <button
                  className="icon-button"
                  onClick={() => setShowHidden((value) => !value)}
                  title="Toggle hidden files"
                  type="button"
                >
                  <Icon name="view-hidden" size={18} />
                </button>
                <button
                  className="icon-button"
                  onClick={refresh}
                  title="Refresh"
                  type="button"
                >
                  <Icon name="view-refresh" size={18} />
                </button>
                <button
                  className={`icon-button${isFavorited ? ' active' : ''}`}
                  onClick={() => isFavorited ? removeFavorite(currentPath) : addFavorite(currentPath)}
                  title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  type="button"
                >
                  <Icon name="bookmark-new" size={18} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : viewMode === 'grid' ? 'columns' : 'list')}
                  title="Change view"
                  type="button"
                >
                  {viewMode === 'list' ? (
                    <Icon name="view-grid" size={18} />
                  ) : (
                    <Icon name="view-list-tree" size={18} />
                  )}
                </button>
                <button
                  className="icon-button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  title={theme === 'light' ? 'Dark mode' : 'Light mode'}
                  type="button"
                >
                  {theme === 'light' ? (
                    <Icon name="weather-clear-night" size={18} />
                  ) : (
                    <Icon name="weather-clear" size={18} />
                  )}
                </button>
                {session?.authEnabled && (
                  <button
                    className="icon-button"
                    onClick={handleLogout}
                    title="Log out"
                    type="button"
                  >
                    <Icon name="system-log-out" size={18} />
                  </button>
                )}
                </div>
              </BreadcrumbBar>
            )}

          {error && <div className={styles.errorBanner}>{error}</div>}

          {showingTrash ? (
            <>
              {selectedTrashIds.length > 0 ? (
                <header className={styles.topbar}>
                  <div className={styles.selectionBar}>
                    <span>{selectedTrashIds.length} selected</span>
                    <div className={styles.selectionActions}>
                      {canWrite && (
                        <button type="button" onClick={handleBulkRestoreTrash}>
                          <Icon name="edit-restore" size={16} />
                          Restore
                        </button>
                      )}
                      {canWrite && (
                        <button type="button" className="danger" onClick={handleBulkDeleteTrash}>
                          <Icon name="edit-delete" size={16} />
                          Delete
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={() => setSelectedTrashIds([])}>
                      Clear
                    </button>
                  </div>
                </header>
              ) : (
                <BreadcrumbBar
                  crumbs={[{ label: 'Desktop' }, { label: 'Trash' }]}
                  onBack={() => setShowingTrash(false)}
                  onNavigate={() => {}}
                >
                  <button
                    className="icon-button"
                    disabled={trashEntries.length === 0}
                    onClick={() => {
                      setSelectedTrashIds(trashEntries.map((e) => e.id));
                      setLastSelectedTrashId(trashEntries.length > 0 ? trashEntries[trashEntries.length - 1].id : null);
                    }}
                    title="Select all"
                    type="button"
                  >
                    <Icon name="selection-select-all" size={18} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={trashEntries.length === 0}
                    onClick={() => {
                      const allIds = trashEntries.map((e) => e.id);
                      setSelectedTrashIds(allIds.filter((id) => !selectedTrashIds.includes(id)));
                      setLastSelectedTrashId(null);
                    }}
                    title="Invert selection"
                    type="button"
                  >
                    <Icon name="selection-invert" size={18} />
                  </button>
                  <select
                    className={styles.sortSelect}
                    value={`${sortField}:${sortDirection}`}
                    onChange={(event) => {
                      const [field, direction] = event.target.value.split(':') as [SortField, SortDirection];
                      setSortField(field);
                      setSortDirection(direction);
                    }}
                    title="Sort trash"
                  >
                    <option value="name:asc">Name A-Z</option>
                    <option value="name:desc">Name Z-A</option>
                    <option value="size:asc">Size small first</option>
                    <option value="size:desc">Size large first</option>
                    <option value="type:asc">Type A-Z</option>
                    <option value="type:desc">Type Z-A</option>
                    <option value="modifiedAt:desc">Deleted newest first</option>
                    <option value="modifiedAt:asc">Deleted oldest first</option>
                  </select>
                  <button
                    className="icon-button"
                    onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                    title="Toggle grid view"
                    type="button"
                  >
                    {viewMode === 'list' ? (
                      <Icon name="view-grid" size={18} />
                    ) : (
                      <Icon name="view-list-tree" size={18} />
                    )}
                  </button>
                  <button className="icon-button" onClick={() => { getTrash().then(r => setTrashEntries(r.entries ?? [])); }} title="Refresh" type="button">
                    <Icon name="view-refresh" size={18} />
                  </button>
                </BreadcrumbBar>
              )}
              <section
                className={`${viewMode === 'grid' ? styles.fileGrid : styles.fileList}`}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedTrashIds([]);
                    setLastSelectedTrashId(null);
                    setTrashContextMenu(null);
                  }
                }}
                onContextMenu={(event) => event.preventDefault()}
                tabIndex={0}
              >
              {trashEntries.length === 0 ? (
                <div className={styles.emptyState}>Trash is empty</div>
              ) : (
                sortedTrashEntries.map((entry) => {
                  const isSelected = selectedTrashIds.includes(entry.id);
                  return viewMode === 'grid' ? (
                    <div
                      className={`${styles.fileRow}${isSelected ? ` ${styles.selected}` : ''}`}
                      key={entry.id}
                      onClick={(event) => handleSelectTrashItem(entry, event)}
                      onContextMenu={(event) => handleTrashContextMenu(entry, event)}
                      role="button"
                    >
                      {entry.type === 'directory' ? (
                        <FolderIcon size={84} />
                      ) : (
                        <FileIcon entry={{
                          name: entry.name,
                          type: entry.type,
                          path: entry.originalPath,
                          size: entry.size,
                          modifiedAt: entry.deletedAt,
                          permissions: '',
                          owner: '',
                          group: '',
                          hidden: false,
                        }} size={84} />
                      )}
                      <span className={styles.fileName}>{entry.name}</span>
                      <span className={styles.fileMeta}>
                        {formatBytes(entry.size)}
                        <span>{formatGridDate(entry.deletedAt)}</span>
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`${styles.fileRow}${isSelected ? ` ${styles.selected}` : ''}`}
                      key={entry.id}
                      onClick={(event) => handleSelectTrashItem(entry, event)}
                      onContextMenu={(event) => handleTrashContextMenu(entry, event)}
                      role="button"
                    >
                      {entry.type === 'directory' ? (
                        <FolderIcon size={28} />
                      ) : (
                        <FileIcon entry={{
                          name: entry.name,
                          type: entry.type,
                          path: entry.originalPath,
                          size: entry.size,
                          modifiedAt: entry.deletedAt,
                          permissions: '',
                          owner: '',
                          group: '',
                          hidden: false,
                        }} size={28} />
                      )}
                      <span className={styles.fileName}>{entry.name}</span>
                      <span>{entry.type}</span>
                      <span>{formatBytes(entry.size)}</span>
                      <span>{new Date(entry.deletedAt).toLocaleString()}</span>
                      <span>{formatTrashPath(entry.originalPath)}</span>
                      <span>{entry.id}</span>
                      <span>{''}</span>
                    </div>
                  );
                })
              )}
              </section>
          </>
        ) : !currentPath ? (
          <div className={styles.desktop}>
            {roots.map((root) => (
              <button
                key={root.path}
                className={styles.desktopIcon}
                onClick={() => navigateTo(root.path)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ x: event.clientX, y: event.clientY, entry: { name: rootLabel(root), path: root.path, type: 'directory', size: 0, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false } });
                }}
                type="button"
              >
                <DeviceIcon name="drive-harddisk" size={64} />
                <span className={styles.desktopIconLabel}>{rootLabel(root)}</span>
                <small className={styles.desktopIconUsage}>{root.path}</small>
                <small className={styles.desktopIconUsage}>{formatRootUsage(root)}</small>
              </button>
            ))}
            <button
              className={styles.desktopIcon}
              onClick={() => {
                setCurrentPath('');
                setShowingTrash(true);
                setSelectedPaths([]);
              }}
              type="button"
            >
              <div className={styles.desktopTrashIcon}>
                <TrashIcon full={trashEntries.length > 0} size={64} />
                {trashEntries.length > 0 && <span className={styles.desktopTrashBadge}>{trashEntries.length}</span>}
              </div>
              <span className={styles.desktopIconLabel}>Trash</span>
              <small className={styles.desktopIconUsage}>{trashEntries.length === 0 ? 'Empty' : `${trashEntries.length} item${trashEntries.length === 1 ? '' : 's'}`}</small>
            </button>
          </div>
        ) : (
        <section
          className={`${viewMode === 'grid' ? styles.fileGrid : viewMode === 'columns' ? styles.fileColumns : styles.fileList}${draggingUpload ? ` ${styles.dragOver}` : ''}`}
          ref={fileGridRef}
          onDragLeave={handleFileAreaDragLeave}
          onDragOver={handleFileAreaDragOver}
          onDrop={handleFileAreaDrop}
          onClick={handleFileAreaClick}
          onMouseDown={handleFileAreaMouseDown}
          onKeyDown={handleFileAreaKeyDown}
          tabIndex={0}
        >
          {loading ? (
            viewMode === 'columns' ? (
              <div className={styles.emptyState}>Loading...</div>
            ) : viewMode === 'grid' ? (
              <div className={styles.skeletonGrid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={styles.skeletonCard}>
                    <div className={styles.skeletonIcon} />
                    <div className={styles.skeletonLine} />
                    <div className={`${styles.skeletonLine} ${styles.short}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Loading folder...</div>
            )
          ) : filteredEntries.length === 0 ? (
            viewMode === 'columns' ? (
              <div className={styles.emptyState}>No files found in {currentPath}</div>
            ) : (
              <div className={styles.emptyState}>No files found in {currentPath}</div>
            )
          ) : viewMode === 'columns' ? (
            <div className={styles.columnBrowser}>
              {buildColumnPath(currentPath).map((col, colIdx) => (
                <div key={col} className={styles.columnPane}>
                  {col === currentPath ? (
                    filteredEntries.map((entry, index) => (
                      <div
                        className={`${styles.columnItem}${selectedPaths.includes(entry.path) ? ` ${styles.selected}` : ''}`}
                        key={entry.path}
                        data-index={index}
                        onClick={(event) => handleSelectEntry(entry, event)}
                        onContextMenu={(event) => handleContextMenu(entry, event)}
                        onDoubleClick={() => {
                          if (renaming) return;
                          if (entry.type === 'directory') {
                            navigateTo(entry.path);
                          } else {
                            const ext = entry.name.toLowerCase();
                            if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext) || ext.endsWith('.pdf')) {
                              setPreviewEntry(entry);
                            } else {
                              window.open(downloadUrl(entry.path), '_blank');
                            }
                          }
                        }}
                      >
                        {entry.type === 'directory' ? <FolderIcon size={18} /> : <FileIcon entry={entry} size={18} />}
                        <span className={styles.columnItemName}>{entry.name}</span>
                      </div>
                    ))
                  ) : (
                    <div
                      className={styles.columnItem}
                      onClick={() => navigateTo(col)}
                    >
                      <FolderIcon size={18} />
                      <span className={styles.columnItemName}>{col === '/' ? '/' : col.split('/').pop() || col}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            filteredEntries.map((entry, index) => {
              const fileIconSize = viewMode === 'grid' ? 84 : 28;
              return (
                <div
                  className={`${selectedPaths.includes(entry.path) ? `${styles.fileRow} ${styles.selected}` : styles.fileRow}${dragOverPath === entry.path ? ` ${styles.dragOver}` : ''}`}
                  key={entry.path}
                  data-index={index}
                  draggable={canWrite}
                  onDragStart={(event) => handleFileDragStart(event, entry)}
                  onDragOver={(event) => entry.type === 'directory' ? handleFolderDragOver(event, entry.path) : undefined}
                  onDragLeave={entry.type === 'directory' ? () => handleFolderDragLeave() : undefined}
                  onDrop={(event) => entry.type === 'directory' ? handleDropOnFolder(event, entry.path) : undefined}
                  onClick={(event) => handleSelectEntry(entry, event)}
                  onContextMenu={(event) => handleContextMenu(entry, event)}
                  onTouchStart={(event) => {
                    const touch = event.touches[0];
                    longPressEntry.current = { entry, x: touch.clientX, y: touch.clientY };
                    const timer = window.setTimeout(() => {
                      const lp = longPressEntry.current;
                      if (lp) {
                        setContextMenu({ x: lp.x, y: lp.y, entry: lp.entry });
                        longPressEntry.current = null;
                      }
                    }, 500);
                    (document as any).__longPressTimer = timer;
                  }}
                  onTouchMove={() => {
                    longPressEntry.current = null;
                    const timer = (document as any).__longPressTimer;
                    if (timer) { window.clearTimeout(timer); delete (document as any).__longPressTimer; }
                  }}
                  onTouchEnd={() => {
                    const timer = (document as any).__longPressTimer;
                    if (timer) { window.clearTimeout(timer); delete (document as any).__longPressTimer; }
                  }}
                  onDoubleClick={() => {
                    if (renaming) {
                      return;
                    }
                    if (entry.type === 'directory') {
                      navigateTo(entry.path);
                      return;
                    }
                    const ext = entry.name.toLowerCase();
                    if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext) || ext.endsWith('.pdf')) {
                      setPreviewEntry(entry);
                    } else {
                      window.open(downloadUrl(entry.path), '_blank');
                    }
                  }}
                  role="button"
                >
                  {entry.type === 'directory' ? (
                    <FolderIcon size={fileIconSize} />
                  ) : isImageExtension(entry.name.toLowerCase()) ? (
                    <img
                      className={styles.fileThumb}
                      src={rawUrl(entry.path)}
                      alt={entry.name}
                      loading="lazy"
                    />
                  ) : (
                    <FileIcon entry={entry} size={fileIconSize} />
                  )}
                  {renaming?.path === entry.path ? (
                    <input
                      ref={renameInputRef}
                      className="rename-input"
                      value={renaming.value}
                      onBlur={() => commitRename(entry)}
                      onChange={(event) => setRenaming({ path: entry.path, value: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                      onContextMenu={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitRename(entry);
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                    />
                  ) : (
                    <span className={styles.fileName}>{entry.name}</span>
                  )}
                  {viewMode === 'grid' && (
                    <span className={styles.fileMeta}>
                      {formatBytes(entry.size)}
                      <span>{formatGridDate(entry.modifiedAt)}</span>
                    </span>
                  )}
                  {viewMode === 'list' && (
                    <>
                      <span>{entry.type}</span>
                      <span>{formatBytes(entry.size)}</span>
                      <span>{new Date(entry.modifiedAt).toLocaleString()}</span>
                      <span>{entry.permissions}</span>
                      <span>{entry.owner}</span>
                      <span>{entry.group}</span>
                    </>
                  )}
                </div>
              );
            })
          )}
          {rubberBandStyle && <div className={styles.rubberBand} style={rubberBandStyle} />}
        </section>
        )}

        {contextMenu && (
          <div
            className={styles.contextMenu}
            style={{ left: contextMenu.x, top: contextMenu.y }}
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
            <button type="button" className={styles.danger} onClick={handleDelete} disabled={!canWrite || !canDelete}>
              <Icon name="edit-delete" size={16} />
              Delete
            </button>
          </div>
        )}
        {trashContextMenu && canWrite && (
          <div
            className={styles.contextMenu}
            style={{ left: trashContextMenu.x, top: trashContextMenu.y }}
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

      <aside className={styles.jobDrawer}>
        <div className={styles.drawerHeader}>
          <h2>Jobs</h2>
          <span>{jobs.length}</span>
        </div>
        <div className={styles.jobFilterTabs}>
          {(['all', 'active', 'completed', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.jobFilterTab}${jobFilter === tab ? ` ${styles.active}` : ''}`}
              onClick={() => setJobFilter(tab)}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.jobList}>
          {jobs.length === 0 ? (
            <p className="muted">No jobs yet</p>
          ) : (
            <>
              {renderJobGroup(jobs, jobFilter, completedCollapsed, setCompletedCollapsed, handleCancelJob, handlePauseJob, handleResumeJob, handleRetryJob)}
              {jobs.some((j) => j.status === 'completed' || j.status === 'cancelled') && (
                <button type="button" className={styles.jobClearBtn} onClick={handleClearCompleted}>
                  Clear completed
                </button>
              )}
              {jobs.some((j) => j.status === 'failed') && (
                <button type="button" className={styles.jobClearBtn} onClick={handleClearFailed}>
                  Clear failed
                </button>
              )}
            </>
          )}
        </div>
      </aside>
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
      </>
    );
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
        <h1>Volum</h1>
        <select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'readonly')}>
          <option value="admin">Admin</option>
          <option value="readonly">Readonly</option>
        </select>
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





function JobItem({
  job,
  onCancel,
  onPause,
  onResume,
  onRetry
}: {
  job: Job;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const progress = job.totalBytes > 0 ? Math.round((job.processedBytes / job.totalBytes) * 100) : 0;
  const canCancel = job.status === 'queued' || job.status === 'running' || job.status === 'paused';
  const canPause = job.status === 'running';
  const canResume = job.status === 'paused';
  const canRetry = job.status === 'failed' || job.status === 'cancelled';
  const showLiveStats = job.status === 'running';
  const hasKnownTotal = job.totalBytes > 0;

  return (
    <article className={styles.jobItem}>
      <div className={styles.jobTitleRow}>
        <strong>{job.type}</strong>
        <span>{job.status}</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.jobMeta}>
        <span>
          {hasKnownTotal
            ? `${formatBytes(job.processedBytes)} / ${formatBytes(job.totalBytes)}`
            : `${formatBytes(job.processedBytes)} uploaded`}
        </span>
        {showLiveStats && job.speedBytesPerSecond ? <span>{formatBytes(job.speedBytesPerSecond)}/s</span> : null}
        {showLiveStats && job.etaSeconds !== undefined ? <span>{formatDuration(job.etaSeconds)} left</span> : null}
      </div>
      <p>{job.currentItem ?? job.sourcePath ?? job.id}</p>
      {job.errorMessage && <p className={styles.jobError}>{job.errorMessage}</p>}
      {(canPause || canResume || canCancel || canRetry) && (
        <div className={styles.jobActions}>
          {canPause && (
            <button type="button" onClick={() => onPause(job.id)}>
              <Icon name="media-playback-pause" size={15} />
              Pause
            </button>
          )}
          {canResume && (
            <button type="button" onClick={() => onResume(job.id)}>
              <Icon name="media-playback-start" size={15} />
              Resume
            </button>
          )}
          {canCancel && (
            <button type="button" onClick={() => onCancel(job.id)}>
              <Icon name="process-stop" size={15} />
              Cancel
            </button>
          )}
          {canRetry && (
            <button type="button" onClick={() => onRetry(job.id)}>
              <Icon name="view-refresh" size={15} />
              Retry
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function isActiveStatus(status: string) {
  return status === 'queued' || status === 'running' || status === 'paused';
}

function renderJobGroup(
  jobs: Job[],
  jobFilter: string,
  completedCollapsed: boolean,
  setCompletedCollapsed: (v: boolean) => void,
  onCancel: (id: string) => void,
  onPause: (id: string) => void,
  onResume: (id: string) => void,
  onRetry: (id: string) => void,
) {
  const terminal = ['completed', 'failed', 'cancelled'];
  const filtered = jobFilter === 'all'
    ? jobs
    : jobFilter === 'active'
      ? jobs.filter((j) => isActiveStatus(j.status))
      : jobs.filter((j) => j.status === jobFilter);

  const active = filtered.filter((j) => isActiveStatus(j.status));
  const terminalJobs = filtered.filter((j) => terminal.includes(j.status));

  return (
    <>
      {active.map((job) => (
        <JobItem key={job.id} job={job} onCancel={onCancel} onPause={onPause} onResume={onResume} onRetry={onRetry} />
      ))}
      {terminalJobs.length > 0 && (
        <>
          <button
            type="button"
            className={styles.jobCollapseToggle}
            onClick={() => setCompletedCollapsed(!completedCollapsed)}
          >
            {completedCollapsed ? `Show ${terminalJobs.length} completed` : 'Hide completed'}
          </button>
          {!completedCollapsed && terminalJobs.map((job) => (
            <JobItem key={job.id} job={job} onCancel={onCancel} onPause={onPause} onResume={onResume} onRetry={onRetry} />
          ))}
        </>
      )}
    </>
  );
}

function formatBytes(value: number) {
  if (value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatRootUsage(root: RootEntry) {
  if (!root.available) {
    return 'Unavailable';
  }
  if (root.totalBytes <= 0) {
    return 'Usage unavailable';
  }
  const fsType = root.fsType ? ` · ${root.fsType}` : '';
  return `${formatBytes(root.usedBytes)} used of ${formatBytes(root.totalBytes)} | ${formatBytes(root.freeBytes)} free${fsType}`;
}

function rootLabel(root: RootEntry) {
  if (root.label) {
    return root.label;
  }
  if (root.path === '/') {
    return 'Server root';
  }
  return root.path.split('/').filter(Boolean).pop() || root.path;
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

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return 'less than 1s';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
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

function buildColumnPath(currentPath: string, roots: string[] = ['/']): string[] {
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
