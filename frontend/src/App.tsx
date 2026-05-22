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
type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
} | null;
type TextInputDialogState = {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  folderSuggestions?: string[];
  suggestionLabel?: string;
  applyFolderSuggestion?: (path: string) => string;
  onSubmit: (value: string) => void;
} | null;
type TransferDialogState = {
  mode: 'copy' | 'move';
  entries: FileEntry[];
  initialDestination: string;
} | null;
type ClipboardState = {
  mode: 'copy' | 'move';
  entries: FileEntry[];
} | null;
type Toast = {
  id: number;
  title: string;
  message?: string;
  variant: 'success' | 'error';
};

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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<RenameState>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggingUpload, setDraggingUpload] = useState(false);
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
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
    setContextMenu(null);
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

  const canRename = selectedEntries.length === 1;
  const canDownload = selectedEntries.length === 1;
  const canDelete = selectedEntries.length > 0;
  const canCopy = selectedEntries.length > 0;
  const canMove = selectedEntries.length > 0;
  const canPreview = selectedEntries.length === 1 && selectedEntries[0].type === 'file';
  const canArchive = selectedEntries.length === 1;
  const canExtract = selectedEntries.length === 1 && selectedEntries[0].type === 'file' && isArchiveFile(selectedEntries[0].name);
  const canChecksum = selectedEntries.length === 1;
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
        setCurrentPath(selectedEntries[0].path);
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
    const closeContextMenu = () => setContextMenu(null);
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
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  if (sessionLoading) {
    return <div className="auth-shell">Loading...</div>;
  }

  if (session?.authEnabled && !session.authenticated) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />;
  }

  const shell = (
    <>
      <main className="app-shell">
        <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={appIcon} alt="" />
          <div>
            <strong>Volum</strong>
            <span>File manager</span>
            {session?.authEnabled && <span>{session.role}</span>}
          </div>
        </div>

        <section className="nav-section">
          <h2>Storage</h2>
          <div className="root-list">
            {roots.map((root) => (
              <button
                className={root.path === currentPath ? 'root-item active' : 'root-item'}
                key={root.path}
                onClick={() => navigateTo(root.path)}
                type="button"
              >
                <DeviceIcon name="drive-harddisk" size={18} />
                <span className="root-details">
                  <span>{root.path}</span>
                  <small>{formatRootUsage(root)}</small>
                  {root.totalBytes > 0 && (
                    <span className="root-meter" aria-hidden="true">
                      <span style={{ width: `${Math.min((root.usedBytes / root.totalBytes) * 100, 100)}%` }} />
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        {favorites.length > 0 && (
          <section className="nav-section">
            <div className="section-heading">
              <h2>Favorites</h2>
            </div>
            <div className="root-list">
      {favorites.map((path) => (
                  <div
                    className={path === currentPath ? 'root-item active' : 'root-item'}
                    key={path}
                    onClick={() => { setCurrentPath(path); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setCurrentPath(path); }}
                  >
                    <FolderIcon size={18} />
                    <span className="fav-details" style={{ flex: 1 }}>
                      <span>{path.split('/').pop() || path}</span>
                      <small>{path}</small>
                    </span>
                    <button
                      className="fav-remove"
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
          <section className="nav-section">
            <div className="section-heading">
              <h2>Recent</h2>
            </div>
            <div className="root-list">
              {recentPaths.map((path) => (
                <button
                  className={path === currentPath ? 'root-item active' : 'root-item'}
                  key={path}
                  onClick={() => { setCurrentPath(path); }}
                  type="button"
                >
                  <FolderIcon size={18} />
                  <span className="fav-details" style={{ flex: 1 }}>
                    <span>{path.split('/').pop() || path}</span>
                    <small>{path}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="nav-section trash-section">
          <div className="section-heading">
            <h2>Trash</h2>
            <span>{trashEntries.length}</span>
          </div>
          {trashEntries.length === 0 ? (
            <p className="muted compact">Trash is empty</p>
          ) : (
            <div className="trash-list">
              {trashEntries.slice(0, 6).map((entry) => (
                <div className="trash-item" key={entry.id}>
                  <div>
                    <strong>{entry.name}</strong>
                    <span>{formatTrashPath(entry.originalPath)}</span>
                    <small>{formatBytes(entry.size)} · {new Date(entry.deletedAt).toLocaleDateString()}</small>
                  </div>
                  {canWrite && (
                    <div className="trash-actions">
                      <button type="button" title="Restore" onClick={() => handleRestoreTrash(entry)}>
                        <Icon name="edit-restore" size={15} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        title="Delete permanently"
                        onClick={() => handleDeleteTrash(entry)}
                      >
                        <Icon name="edit-delete" size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {trashEntries.length > 6 && <p className="muted compact">+{trashEntries.length - 6} more</p>}
            </div>
          )}
        </section>
      </aside>

      <section className="workspace" onClick={handleWorkspaceClick}>
        <header className="topbar">
          {selectedEntries.length > 0 ? (
            <div className="selection-bar">
              <span>{selectedEntries.length} selected</span>
              <div className="selection-actions">
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
          ) : (
            <>
              <nav className="breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                  <button key={crumb.path} onClick={() => navigateTo(crumb.path)} type="button">
                    {index > 0 && <Icon name="go-next" size={16} />}
                    <span>{crumb.label}</span>
                  </button>
                ))}
              </nav>

              <div className="toolbar">
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
                  className="hidden-file-input"
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
                <label className="search">
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
                    <button type="button" className="search-clear" onClick={() => { setQuery(''); setSearchResults(null); setSearchOpen(false); }}>
                      <Icon name="window-close" size={14} />
                    </button>
                  )}
                </label>
                {searchOpen && searchResults && searchResults.length > 0 && (
                  <div className="search-results-dropdown">
                    {searchResults.map((result) => (
                      <button
                        key={result.path}
                        type="button"
                        className="search-result-item"
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
                        <span className="search-result-name">{result.name}</span>
                        <span className="search-result-path">{result.root}</span>
                      </button>
                    ))}
                  </div>
                )}
                <select
                  className="sort-select"
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
            </>
          )}
        </header>

        {error && <div className="error-banner">{error}</div>}

        {!currentPath ? (
          <div className="desktop">
            {roots.map((root) => (
              <button
                key={root.path}
                className="desktop-icon"
                onClick={() => navigateTo(root.path)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ x: event.clientX, y: event.clientY, entry: { name: root.path, path: root.path, type: 'directory', size: 0, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false } });
                }}
                type="button"
              >
                <DeviceIcon name="drive-harddisk" size={64} />
                <span className="desktop-icon-label">{root.path}</span>
                <small className="desktop-icon-usage">{formatRootUsage(root)}</small>
              </button>
            ))}
            <button
              className="desktop-icon"
              onClick={() => {
                document.querySelector('.trash-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              type="button"
            >
              <div className="desktop-trash-icon">
                <TrashIcon full={trashEntries.length > 0} size={64} />
                {trashEntries.length > 0 && <span className="desktop-trash-badge">{trashEntries.length}</span>}
              </div>
              <span className="desktop-icon-label">Trash</span>
              <small className="desktop-icon-usage">{trashEntries.length === 0 ? 'Empty' : `${trashEntries.length} item${trashEntries.length === 1 ? '' : 's'}`}</small>
            </button>
          </div>
        ) : (
        <section
          className={`${viewMode === 'grid' ? 'file-grid' : viewMode === 'columns' ? 'file-columns' : 'file-list'}${draggingUpload ? ' drag-over' : ''}`}
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
              <div className="empty-state">Loading...</div>
            ) : viewMode === 'grid' ? (
              <div className="skeleton-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Loading folder...</div>
            )
          ) : filteredEntries.length === 0 ? (
            viewMode === 'columns' ? (
              <div className="empty-state">No files found in {currentPath}</div>
            ) : (
              <div className="empty-state">No files found in {currentPath}</div>
            )
          ) : viewMode === 'columns' ? (
            <div className="column-browser">
              {buildColumnPath(currentPath).map((col, colIdx) => (
                <div key={col} className="column-pane">
                  {col === currentPath ? (
                    filteredEntries.map((entry, index) => (
                      <div
                        className={`column-item${selectedPaths.includes(entry.path) ? ' selected' : ''}`}
                        key={entry.path}
                        data-index={index}
                        onClick={(event) => handleSelectEntry(entry, event)}
                        onContextMenu={(event) => handleContextMenu(entry, event)}
                        onDoubleClick={() => {
                          if (renaming) return;
                          if (entry.type === 'directory') {
                            setCurrentPath(entry.path);
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
                        <span className="column-item-name">{entry.name}</span>
                      </div>
                    ))
                  ) : (
                    <div
                      className="column-item"
                      onClick={() => setCurrentPath(col)}
                    >
                      <FolderIcon size={18} />
                      <span className="column-item-name">{col === '/' ? '/' : col.split('/').pop() || col}</span>
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
                  className={selectedPaths.includes(entry.path) ? 'file-row selected' : 'file-row'}
                  key={entry.path}
                  data-index={index}
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
                      setCurrentPath(entry.path);
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
                      className="file-thumb"
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
                    <span className="file-name">{entry.name}</span>
                  )}
                  {viewMode === 'grid' && (
                    <span className="file-meta">
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
          {rubberBandStyle && <div className="rubber-band" style={rubberBandStyle} />}
        </section>
        )}

        {contextMenu && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
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
            <button type="button" onClick={handleDownload} disabled={!canDownload}>
              <Icon name="edit-download" size={16} />
              Download
            </button>
            <button type="button" onClick={handlePreview} disabled={!canPreview}>
              <Icon name="view-preview" size={16} />
              Preview
            </button>
            <button type="button" onClick={handleShowInfo} disabled={!canPreview}>
              <Icon name="dialog-information" size={16} />
              Info
            </button>
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
            <button type="button" className="danger" onClick={handleDelete} disabled={!canWrite || !canDelete}>
              <Icon name="edit-delete" size={16} />
              Delete
            </button>
          </div>
        )}
      </section>

      <aside className="job-drawer">
        <div className="drawer-header">
          <h2>Jobs</h2>
          <span>{jobs.length}</span>
        </div>
        <div className="job-filter-tabs">
          {(['all', 'active', 'completed', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`job-filter-tab${jobFilter === tab ? ' active' : ''}`}
              onClick={() => setJobFilter(tab)}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="job-list">
          {jobs.length === 0 ? (
            <p className="muted">No jobs yet</p>
          ) : (
            <>
              {renderJobGroup(jobs, jobFilter, completedCollapsed, setCompletedCollapsed, handleCancelJob, handlePauseJob, handleResumeJob, handleRetryJob)}
              {jobs.some((j) => j.status === 'completed' || j.status === 'cancelled') && (
                <button type="button" className="job-clear-btn" onClick={handleClearCompleted}>
                  Clear completed
                </button>
              )}
              {jobs.some((j) => j.status === 'failed') && (
                <button type="button" className="job-clear-btn" onClick={handleClearFailed}>
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
        <div className="shortcuts-overlay" ref={shortcutsRef} onClick={(e) => { if (e.target === shortcutsRef.current) setShortcutsOpen(false); }}>
          <div className="shortcuts-panel">
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcut-row"><span>Navigate into folder / Open file</span><span className="shortcut-key">Enter</span></div>
            <div className="shortcut-row"><span>Deselect all</span><span className="shortcut-key">Esc</span></div>
            <div className="shortcut-row"><span>Select all</span><span className="shortcut-key">⌘A</span></div>
            <div className="shortcut-row"><span>Copy selected items</span><span className="shortcut-key">⌘C</span></div>
            <div className="shortcut-row"><span>Cut selected items</span><span className="shortcut-key">⌘X</span></div>
            <div className="shortcut-row"><span>Paste clipboard items</span><span className="shortcut-key">⌘V</span></div>
            <div className="shortcut-row"><span>Invert selection</span><span className="shortcut-key">⌘I</span></div>
            <div className="shortcut-row"><span>Global search</span><span className="shortcut-key">⌘K</span></div>
            <div className="shortcut-row"><span>Toggle shortcuts</span><span className="shortcut-key">?</span></div>
            <div className="shortcut-row"><span>Rename selected item</span><span className="shortcut-key">F2</span></div>
            <div className="shortcut-row"><span>Move selected items to trash</span><span className="shortcut-key">Delete</span></div>
            <div className="shortcut-row"><span>Shift-range select</span><span className="shortcut-key">⇧+click</span></div>
            <div className="shortcut-row"><span>Multi-select toggle</span><span className="shortcut-key">⌘+click</span></div>
            <hr />
            <div className="shortcut-row"><span>Close preview / Clear search</span><span className="shortcut-key">Esc</span></div>
            <div className="shortcut-row"><span>Context menu</span><span className="shortcut-key">Right click</span></div>
          </div>
        </div>
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
    <main className="auth-shell">
      <form className="login-panel" onSubmit={handleSubmit}>
        <img className="brand-mark" src={appIcon} alt="" />
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
        {error && <p className="login-error">{error}</p>}
        <button disabled={submitting || password.length === 0} type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.variant}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            {toast.message && <span>{toast.message}</span>}
          </div>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            <Icon name="window-close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ dialog, onClose }: { dialog: NonNullable<ConfirmDialogState>; onClose: () => void }) {
  useDialogEscape(onClose);

  const handleConfirm = () => {
    onClose();
    dialog.onConfirm();
  };

  return (
    <div className="dialog-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="app-dialog app-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="app-dialog-header">
          <h3 id="confirm-dialog-title">{dialog.title}</h3>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="window-close" size={18} />
          </button>
        </div>
        <p className="dialog-message">{dialog.message}</p>
        <div className="dialog-actions">
          <button type="button" className="dialog-button secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`dialog-button ${dialog.danger ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextInputDialog({ dialog, onClose }: { dialog: NonNullable<TextInputDialogState>; onClose: () => void }) {
  const [value, setValue] = useState(dialog.initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogEscape(onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`${dialog.label} is required.`);
      return;
    }
    dialog.onSubmit(trimmed);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <form className="app-dialog app-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="text-dialog-title" onSubmit={handleSubmit}>
        <div className="app-dialog-header">
          <h3 id="text-dialog-title">{dialog.title}</h3>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="window-close" size={18} />
          </button>
        </div>
        <label className="dialog-field">
          <span>{dialog.label}</span>
          <input
            ref={inputRef}
            value={value}
            placeholder={dialog.placeholder}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
          />
        </label>
        {dialog.folderSuggestions && dialog.folderSuggestions.length > 0 && (
          <FolderSuggestions
            label={dialog.suggestionLabel ?? 'Folders'}
            paths={dialog.folderSuggestions}
            onSelect={(path) => {
              setValue(dialog.applyFolderSuggestion ? dialog.applyFolderSuggestion(path) : normalizeFolderPath(path));
              setError(null);
            }}
          />
        )}
        {error && <p className="dialog-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="dialog-button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="dialog-button primary">{dialog.confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

function TransferDialog({
  dialog,
  folderSuggestions,
  onClose,
  onSubmit
}: {
  dialog: NonNullable<TransferDialogState>;
  folderSuggestions: string[];
  onClose: () => void;
  onSubmit: (dialog: TransferDialogState, destinationValue: string, conflictPolicy: ConflictPolicy) => void;
}) {
  const [destination, setDestination] = useState(dialog.initialDestination);
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('ask');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const title = dialog.mode === 'copy' ? 'Copy Items' : 'Move Items';
  const actionLabel = dialog.mode === 'copy' ? 'Copy' : 'Move';
  const itemLabel = dialog.entries.length === 1 ? dialog.entries[0].name : `${dialog.entries.length} selected items`;

  useDialogEscape(onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (destination.split('|').map((s) => s.trim()).filter(Boolean).length === 0) {
      setError('Destination folder path is required.');
      return;
    }
    onSubmit(dialog, destination, conflictPolicy);
  };

  return (
    <div className="dialog-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <form className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="transfer-dialog-title" onSubmit={handleSubmit}>
        <div className="app-dialog-header">
          <div>
            <h3 id="transfer-dialog-title">{title}</h3>
            <p>{itemLabel}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="window-close" size={18} />
          </button>
        </div>
        <label className="dialog-field">
          <span>Destination folder path</span>
          <input
            ref={inputRef}
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              setError(null);
            }}
            placeholder="/path/to/folder"
          />
        </label>
        <p className="dialog-help">Use | to send items to multiple destinations.</p>
        {folderSuggestions.length > 0 && (
          <FolderSuggestions
            label="Choose destination"
            paths={folderSuggestions}
            onSelect={(path) => {
              setDestination(normalizeFolderPath(path));
              setError(null);
            }}
          />
        )}
        <label className="dialog-field">
          <span>If a file already exists</span>
          <select value={conflictPolicy} onChange={(event) => setConflictPolicy(event.target.value as ConflictPolicy)}>
            <option value="ask">Ask when needed</option>
            <option value="skip">Skip existing files</option>
            <option value="overwrite">Overwrite existing files</option>
            <option value="rename">Rename new files</option>
            <option value="cancel">Cancel the job</option>
          </select>
        </label>
        {error && <p className="dialog-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="dialog-button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="dialog-button primary">{actionLabel}</button>
        </div>
      </form>
    </div>
  );
}

function FolderSuggestions({
  label,
  paths,
  onSelect
}: {
  label: string;
  paths: string[];
  onSelect: (path: string) => void;
}) {
  return (
    <div className="dialog-suggestions">
      <span>{label}</span>
      <div>
        {paths.map((path) => (
          <button key={path} type="button" onClick={() => onSelect(path)} title={path}>
            {folderSuggestionLabel(path)}
          </button>
        ))}
      </div>
    </div>
  );
}

function useDialogEscape(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
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
    <article className="job-item">
      <div className="job-title-row">
        <strong>{job.type}</strong>
        <span>{job.status}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="job-meta">
        <span>
          {hasKnownTotal
            ? `${formatBytes(job.processedBytes)} / ${formatBytes(job.totalBytes)}`
            : `${formatBytes(job.processedBytes)} uploaded`}
        </span>
        {showLiveStats && job.speedBytesPerSecond ? <span>{formatBytes(job.speedBytesPerSecond)}/s</span> : null}
        {showLiveStats && job.etaSeconds !== undefined ? <span>{formatDuration(job.etaSeconds)} left</span> : null}
      </div>
      <p>{job.currentItem ?? job.sourcePath ?? job.id}</p>
      {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
      {(canPause || canResume || canCancel || canRetry) && (
        <div className="job-actions">
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
            className="job-collapse-toggle"
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
  if (root.totalBytes <= 0) {
    return 'Usage unavailable';
  }
  return `${formatBytes(root.usedBytes)} used of ${formatBytes(root.totalBytes)} | ${formatBytes(root.freeBytes)} free`;
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

function folderSuggestionLabel(path: string) {
  if (path === '/') {
    return '/';
  }
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
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
