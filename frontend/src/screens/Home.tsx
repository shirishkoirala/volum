import { KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileEntry, TrashEntry,
  deleteTrash, getJobs, getTrash,
} from '../api/client';
import type { SortField, SortDirection } from '../types';
import type { Session } from '../api/client';
import { isPreviewableFile } from '../utils/preview';
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
import { ToastViewport } from '../components/overlay/Toast';
import { FileContextMenu } from '../components/overlay/FileContextMenu';
import { TrashContextMenu } from '../components/overlay/TrashContextMenu';
import { DesktopContextMenu } from '../components/overlay/DesktopContextMenu';
import { ServiceFormModal } from '../components/overlay/ServiceFormModal';
import { FilesEmptyMenu } from '../components/overlay/FilesEmptyMenu';
import { TrashEmptyMenu } from '../components/overlay/TrashEmptyMenu';
import { JobsEmptyMenu } from '../components/overlay/JobsEmptyMenu';
import type { DesktopIconItem } from '../pages/DesktopView';
import { useServiceShortcuts } from '../hooks/useServiceShortcuts';
import { nextServiceId, type ServiceShortcut } from '../utils/services';

import { useJobs } from '../hooks/useJobs';
import { useDragDrop } from '../hooks/useDragDrop';
import { useRubberBand } from '../hooks/useRubberBand';
import { useViewPreferences } from '../hooks/useViewPreferences';
import { useNavigation } from '../hooks/useNavigation';
import { useFavorites } from '../hooks/useFavorites';
import { useWallpaper } from '../hooks/useWallpaper';
import { useFileActions } from '../hooks/useFileActions';
import { useDialogStack } from '../hooks/useDialogStack';
import { useToasts } from '../hooks/useToasts';
import { useFileBrowser } from '../hooks/useFileBrowser';
import { useSelection } from '../hooks/useSelection';
import { useFileCommands } from '../hooks/useFileCommands';
import styles from './Home.module.css';


interface HomeProps {
  session: Session;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Home({ session, onLogout, theme, onToggleTheme }: HomeProps) {
  // ── Core hooks ──
  const viewPref = useViewPreferences();
  const toast = useToasts();

  const browser = useFileBrowser({
    currentPath: viewPref.currentPath,
    showHidden: viewPref.showHidden,
    session,
  });

  const jobHandlers = useJobs(browser.setJobs, {
    session,
    sessionLoading: false,
    onRefresh: browser.refresh,
    showToast: toast.showToast,
  });
  const {
    handleCancelJob, handleRetryJob,
    handlePauseJob, handleResumeJob, handleClearCompleted, handleClearFailed,
  } = jobHandlers;

  const nav = useNavigation(browser.devices, browser.jobs, browser.trashEntries.length, viewPref.currentPath);
  const { favorites, addFavorite, removeFavorite } = useFavorites(viewPref.currentPath);
  const wallpaper = useWallpaper();
  const { services, addService, updateService, removeService } = useServiceShortcuts();
  const fileActions = useFileActions();
  const dialogs = useDialogStack();

  // ── Local state ──
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [trashContextMenu, setTrashContextMenu] = useState<{ x: number; y: number; entry: TrashEntry } | null>(null);
  const [desktopContextMenu, setDesktopContextMenu] = useState<{ x: number; y: number; item: DesktopIconItem } | null>(null);
  const [filesEmptyMenu, setFilesEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [trashEmptyMenu, setTrashEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [jobsEmptyMenu, setJobsEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [serviceFormData, setServiceFormData] = useState<{ initial?: ServiceShortcut } | null>(null);

  const fileGridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressEntry = useRef<{ entry: FileEntry; x: number; y: number } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyMenuBlockedRef = useRef(false);

  // ── Refresh callback ──
  const refresh = useCallback(() => {
    browser.refresh();
    void getTrash().then((r) => browser.setTrashEntries(r.entries ?? []));
  }, [browser]);

  // ── Navigation ──
  const navigateTo = useCallback((path: string) => {
    viewPref.navigateToPath(path);
    nav.setShowingJobs(false);
    browser.setSearchOpen(false);
    browser.setSearchResults(null);
    browser.setQuery('');
    nav.setSelectedDriveName(null);
    nav.setShowingMyPC(false);
  }, [viewPref, nav, browser]);

  const resetToDesktopView = useCallback(() => {
    viewPref.setCurrentPath('');
    nav.setShowingTrash(false);
    nav.setShowingSettings(false);
    nav.setShowingJobs(false);
    nav.setShowingMyPC(false);
    nav.setSelectedDriveName(null);
  }, [viewPref, nav]);

  // ── Hooks that depend on other hooks ──
  const selection = useSelection({
    filteredEntries: browser.filteredEntries,
    trashEntries: browser.trashEntries,
    favorites,
    canWrite: browser.canWrite,
    currentPath: viewPref.currentPath,
  });

  const fileCommands = useFileCommands({
    currentPath: viewPref.currentPath,
    canWrite: browser.canWrite,
    folderSuggestions: browser.folderSuggestions,
    refresh: browser.refresh,
    setError: browser.setError,
    setTrashEntries: browser.setTrashEntries,
    setJobs: browser.setJobs,
    selectedEntries: selection.selectedEntries,
    setSelectedPaths: selection.setSelectedPaths,
    setLastSelectedPath: selection.setLastSelectedPath,
    renaming: fileActions.renaming,
    setRenaming: fileActions.setRenaming,
    setContextMenu: fileActions.setContextMenu,
    setPreviewEntry: fileActions.setPreviewEntry,
    setInfoEntry: fileActions.setInfoEntry,
    setBatchRenameOpen: fileActions.setBatchRenameOpen,
    setAnalyzePath: fileActions.setAnalyzePath,
    fileClipboard: fileActions.fileClipboard,
    setFileClipboard: fileActions.setFileClipboard,
    setConfirmDialog: dialogs.setConfirmDialog,
    setTextInputDialog: dialogs.setTextInputDialog,
    setTransferDialog: dialogs.setTransferDialog,
    setTrashContextMenu,
    setFilesEmptyMenu,
    showToastObj: toast.showToastObj,
    contextMenu: fileActions.contextMenu,
    navigateTo,
    selectedTrashIds: selection.selectedTrashIds,
    setSelectedTrashIds: selection.setSelectedTrashIds,
    setLastSelectedTrashId: selection.setLastSelectedTrashId,
    emptyMenuBlockedRef,
  });

  // ── Effects ──────────────────────────────────────────────

  useEffect(() => { fileCommands.renameInputRef.current?.focus(); fileCommands.renameInputRef.current?.select(); }, [fileActions.renaming, fileCommands.renameInputRef]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); fileActions.setShortcutsOpen((p) => !p); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); browser.setSearchOpen(true); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); if (nav.activeView === 'files') fileActions.setLocationMode((v) => !v); }
      if (e.key === 'Escape' && browser.searchOpen) { browser.setSearchOpen(false); browser.setSearchResults(null); browser.setQuery(''); }
      if (e.key === 'Escape' && fileActions.shortcutsOpen) { fileActions.setShortcutsOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [browser, nav.activeView, fileActions]);

  useEffect(() => {
    const closeMenus = () => {
      fileActions.setContextMenu(null);
      setTrashContextMenu(null);
      setDesktopContextMenu(null);
      setFilesEmptyMenu(null);
      setTrashEmptyMenu(null);
      setJobsEmptyMenu(null);
    };
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    return () => { window.removeEventListener('click', closeMenus); window.removeEventListener('resize', closeMenus); };
  }, [fileActions]);

  useEffect(() => {
    if (!nav.showingTrash && viewPref.viewModeBeforeTrash.current) {
      viewPref.setViewMode(viewPref.viewModeBeforeTrash.current);
      viewPref.viewModeBeforeTrash.current = null;
    }
  }, [nav.showingTrash, viewPref]);

  useEffect(() => { if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission(); }, []);

  // ── Handlers ─────────────────────────────────────────────

  const handleRefreshDesktop = useCallback(() => {
    browser.loadDevices();
    refresh();
    toast.showToastObj({ title: 'Refreshed', variant: 'success' });
  }, [browser, refresh, toast]);

  const handleContextMenuEvent = useCallback((entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    emptyMenuBlockedRef.current = true;
    queueMicrotask(() => { emptyMenuBlockedRef.current = false; });
    if (fileActions.renaming) return;
    if (!selection.selectedPaths.includes(entry.path)) {
      selection.setSelectedPaths([entry.path]);
      selection.setLastSelectedPath(entry.path);
    }
    fileActions.setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }, [fileActions, selection]);

  const handleFilesEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (emptyMenuBlockedRef.current) { emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    fileActions.setContextMenu(null);
    setFilesEmptyMenu({ x: event.clientX, y: event.clientY });
  }, [fileActions]);

  const handleTrashEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (emptyMenuBlockedRef.current) { emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    setTrashContextMenu(null);
    setTrashEmptyMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleJobsEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (emptyMenuBlockedRef.current) { emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    setJobsEmptyMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // ── Touch handlers ──
  const handleEntryTouchStart = useCallback((entry: FileEntry, event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]!;
    longPressEntry.current = { entry, x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      const lp = longPressEntry.current;
      if (lp) { fileActions.setContextMenu({ x: lp.x, y: lp.y, entry: lp.entry }); longPressEntry.current = null; }
    }, 500);
  }, [fileActions]);

  const handleEntryTouchMove = useCallback(() => {
    longPressEntry.current = null;
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleEntryTouchEnd = useCallback(() => {
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  // ── Desktop handlers ─────────────────────────────────────
  const handleDesktopItemContextMenu = useCallback((item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setDesktopContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  const handleEmptyTrash = useCallback(() => {
    setDesktopContextMenu(null);
    dialogs.setConfirmDialog({
      title: 'Empty Trash',
      message: `Permanently delete all ${browser.trashEntries.length} item${browser.trashEntries.length === 1 ? '' : 's'} in trash? This cannot be undone.`,
      confirmLabel: 'Empty Trash',
      danger: true,
      onConfirm: () => {
        void (async () => {
          try {
            for (const entry of browser.trashEntries) await deleteTrash(entry.id);
            const r = await getTrash();
            browser.setTrashEntries(r.entries ?? []);
            browser.setError(null);
            toast.showToastObj({ title: 'Trash emptied', variant: 'success' });
            refresh();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Action failed';
            browser.setError(message);
            toast.showToastObj({ title: 'Action failed', message, variant: 'error' });
          }
        })();
      }
    });
  }, [browser, dialogs, toast, refresh]);

  const handleRemoveDesktopFavorite = useCallback((path: string) => {
    removeFavorite(path);
    toast.showToastObj({ title: 'Removed from desktop', variant: 'success' });
  }, [removeFavorite, toast]);

  // ── Service shortcuts ──
  const handleOpenServiceForm = useCallback((svc?: ServiceShortcut) => {
    setDesktopContextMenu(null);
    setServiceFormData(svc ? { initial: svc } : {});
  }, []);

  const handleSaveService = useCallback((data: { name: string; url: string; iconUrl?: string }) => {
    if (serviceFormData?.initial) {
      updateService(serviceFormData.initial.id, data);
      toast.showToastObj({ title: 'Service updated', variant: 'success' });
    } else {
      addService({ id: nextServiceId(), ...data });
      toast.showToastObj({ title: 'Service added', variant: 'success' });
    }
  }, [serviceFormData, addService, updateService, toast]);

  const handleRemoveService = useCallback((id: string) => {
    removeService(id);
    toast.showToastObj({ title: 'Service removed from desktop', variant: 'success' });
  }, [removeService, toast]);

  const handleDesktopNavigateToTrash = useCallback(() => {
    viewPref.setCurrentPath('');
    nav.setShowingTrash(true);
    nav.setShowingSettings(false);
    nav.setShowingJobs(false);
    nav.setShowingMyPC(false);
    selection.setSelectedPaths([]);
    nav.setSelectedDriveName(null);
    if (viewPref.viewMode === 'columns') viewPref.viewModeBeforeTrash.current = viewPref.viewMode;
    viewPref.setViewMode((prev) => prev === 'columns' ? 'list' : prev);
  }, [viewPref, nav, selection]);

  const handleDockActivate = useCallback((id: string) => {
    switch (id) {
      case 'desktop': resetToDesktopView(); break;
      case 'files':
        nav.setShowingTrash(false); nav.setShowingSettings(false); nav.setShowingJobs(false);
        nav.setShowingMyPC(false); nav.setSelectedDriveName(null);
        if (!viewPref.currentPath) {
          const target = browser.roots.find((r) => r.available)?.path;
          if (target) navigateTo(target);
        }
        break;
      case 'trash':
        viewPref.setCurrentPath('');
        nav.setShowingTrash(true); nav.setShowingSettings(false); nav.setShowingJobs(false);
        viewPref.setViewMode((prev) => prev === 'columns' ? 'list' : prev);
        break;
      case 'jobs':
        nav.setShowingJobs(true); nav.setShowingSettings(false);
        nav.setShowingTrash(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null);
        break;
      case 'settings':
        nav.setShowingSettings(true); nav.setShowingTrash(false);
        nav.setShowingJobs(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null);
        break;
    }
  }, [viewPref, nav, browser.roots, navigateTo, resetToDesktopView]);

  // ── Drag & Drop / Rubber band ────────────────────────────

  const dragDrop = useDragDrop(browser.canWrite, browser.filteredEntries, selection.selectedPaths, dialogs.setTransferDialog, fileCommands.handleUploadFiles);
  const { rubberBandStyle, handleFileAreaMouseDown } = useRubberBand(browser.filteredEntries, selection.setSelectedPaths, selection.setLastSelectedPath, fileGridRef);

  // ── Derived data ─────────────────────────────────────────

  const showStatusBar = nav.activeView !== 'settings' && nav.activeView !== 'jobs' && nav.activeView !== 'desktop';
  const selectedEntryIsFavorited = fileActions.contextMenu?.entry ? favorites.includes(fileActions.contextMenu.entry.path) : selection.isFavorited;

  const sortedTrashEntries = useMemo(() => {
    return [...browser.trashEntries].sort((a, b) => {
      const dir = viewPref.sortDirection === 'asc' ? 1 : -1;
      if (viewPref.sortField === 'name') return a.name.localeCompare(b.name) * dir;
      if (viewPref.sortField === 'size') return (a.size - b.size) * dir;
      if (viewPref.sortField === 'type') return a.type.localeCompare(b.type) * dir;
      return (new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime()) * dir;
    });
  }, [browser.trashEntries, viewPref.sortField, viewPref.sortDirection]);

  const renameInputRef = fileCommands.renameInputRef;
  const fileInputRef = fileCommands.fileInputRef;

  // ── File area keydown wrapper ──
  const handleFileAreaKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    fileCommands.handleFileAreaKeyDown(event);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selection.handleSelectAll();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      selection.handleInvertSelection();
      return;
    }
  }, [fileCommands, selection]);

  // ── Shell JSX ────────────────────────────────────────────

  const shell = (
    <>
      <main className={styles.appShell}>
        <TopBar
          activeView={nav.activeView}
          title={nav.topBarTitle}
          onGoDesktop={resetToDesktopView}
          menuHandlers={{
            onCreateFolder: fileCommands.handleCreateFolder,
            onUpload: () => fileInputRef.current?.click(),
            onCut: () => fileCommands.setClipboardFromSelection('move'),
            onCopy: () => fileCommands.setClipboardFromSelection('copy'),
            onPaste: fileCommands.handlePaste,
            onSelectAll: selection.handleSelectAll,
            onInvertSelection: selection.handleInvertSelection,
            onRename: fileCommands.handleRename,
            onDelete: fileCommands.handleDelete,
            viewMode: viewPref.viewMode,
            onSetViewMode: viewPref.setViewMode,
            showHidden: viewPref.showHidden,
            onToggleHidden: () => viewPref.setShowHidden((v: boolean) => !v),
            sortField: viewPref.sortField,
            sortDirection: viewPref.sortDirection,
            onSortChange: (value: string) => {
              const [f, d] = value.split(':') as [SortField, SortDirection];
              viewPref.setSortField(f);
              viewPref.setSortDirection(d);
            },
            onGoDesktop: resetToDesktopView,
            onGoFiles: () => { nav.setShowingMyPC(false); handleDockActivate('files'); },
            onGoTrash: () => {
              viewPref.setCurrentPath('');
              nav.setShowingTrash(true); nav.setShowingSettings(false); nav.setShowingJobs(false);
              viewPref.setViewMode((prev) => prev === 'columns' ? 'list' : prev);
            },
            onGoJobs: () => {
              nav.setShowingJobs(true); nav.setShowingSettings(false);
              nav.setShowingTrash(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null);
            },
            onGoSettings: () => {
              nav.setShowingSettings(true); nav.setShowingTrash(false);
              nav.setShowingJobs(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null);
            },
            onToggleLocation: () => fileActions.setLocationMode((v) => !v),
            canWrite: browser.canWrite,
            selectedCount: nav.showingTrash ? selection.selectedTrashIds.length : selection.selectedPaths.length,
          }}
        />
        <Dock items={nav.dockItems} onActivate={handleDockActivate} />

        <section className={styles.workspace} onClick={selection.handleWorkspaceClick}>
          {nav.activeView === 'desktop' && (
            <DesktopView
              devices={browser.devices} roots={browser.roots} trashEntries={browser.trashEntries} jobs={browser.jobs}
              favorites={favorites} services={services}
              selectedDriveName={nav.selectedDriveName}
              onNavigateTo={navigateTo}
              onNavigateToTrash={handleDesktopNavigateToTrash}
              onOpenSettings={() => { nav.setShowingSettings(true); nav.setShowingTrash(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null); }}
              onOpenJobs={() => { nav.setShowingJobs(true); nav.setShowingSettings(false); nav.setShowingTrash(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null); }}
              onOpenFiles={() => handleDockActivate('files')}
              onSelectDrive={nav.setSelectedDriveName}
              showingMyPC={nav.showingMyPC}
              onShowMyPC={nav.setShowingMyPC}
              deviceError={browser.deviceError} onRetryDevices={browser.loadDevices}
              wallpaperStyle={wallpaper.wallpaperStyle}
              onItemContextMenu={handleDesktopItemContextMenu}
            />
          )}
          {nav.activeView === 'trash' && (
            <TrashView
              trashEntries={browser.trashEntries} selectedTrashIds={selection.selectedTrashIds}
              onSelectTrash={selection.handleSelectTrashItem}
              sortedTrashEntries={sortedTrashEntries}
              onTrashContextMenu={fileCommands.handleTrashContextMenu}
              onTrashEmptyContextMenu={handleTrashEmptyContextMenu}
            />
          )}
          {nav.activeView === 'files' && (
            <FilesView
              navigation={{
                currentPath: viewPref.currentPath, breadcrumbs: browser.breadcrumbs,
                onNavigate: navigateTo,
                onGoUp: () => viewPref.setCurrentPath(''),
                locationMode: fileActions.locationMode,
                onLocationNavigate: (path: string) => navigateTo(path.startsWith('/') ? path : `/${path}`),
                onToggleLocationMode: () => fileActions.setLocationMode((v) => !v),
              }}
              search={{
                query: browser.query, searchOpen: browser.searchOpen, searchResults: browser.searchResults,
                onSearch: (q) => { browser.setQuery(q); if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => browser.handleGlobalSearch(q), 200); browser.setSearchOpen(true); },
                onClearSearch: () => { browser.setQuery(''); browser.setSearchResults(null); browser.setSearchOpen(false); },
                onSearchResultClick: (result) => {
                  if (result.type === 'directory') navigateTo(result.path);
                  else { const idx = result.path.lastIndexOf('/'); navigateTo(idx < 0 ? '/' : result.path.substring(0, idx) || '/'); }
                },
                searchRef: searchRef as React.RefObject<HTMLInputElement>,
                fileInputRef: fileInputRef as React.RefObject<HTMLInputElement>,
                onUpload: fileCommands.handleUploadFiles,
                onRefresh: refresh,
                isFavorited: selection.isFavorited,
                onToggleFavorite: () => selection.isFavorited ? removeFavorite(viewPref.currentPath) : addFavorite(viewPref.currentPath),
              }}
              selection={{
                selectedPaths: selection.selectedPaths,
                filteredEntries: browser.filteredEntries,
                fileClick: selection.handleFileClick,
              }}
              dragDrop={{
                draggingUpload: dragDrop.draggingUpload,
                onFileAreaDragOver: dragDrop.handleFileAreaDragOver,
                onFileAreaDragLeave: dragDrop.handleFileAreaDragLeave,
                onFileAreaDrop: dragDrop.handleFileAreaDrop,
                onFileAreaMouseDown: handleFileAreaMouseDown,
                onFileAreaKeyDown: handleFileAreaKeyDown,
                onFileDragStart: dragDrop.handleFileDragStart,
                onFolderDragOver: dragDrop.handleFolderDragOver,
                onFolderDragLeave: dragDrop.handleFolderDragLeave,
                onDropOnFolder: dragDrop.handleDropOnFolder,
                dragOverPath: dragDrop.dragOverPath,
              }}
              rename={{
                renameState: fileActions.renaming,
                renameInputRef: renameInputRef as React.RefObject<HTMLInputElement>,
                onSubmitRename: fileCommands.commitRename,
                onCancelRename: fileCommands.cancelRename,
                onRenameChange: (value) => fileActions.setRenaming({ path: fileActions.renaming?.path ?? '', value }),
              }}
              context={{
                onFilesEmptyContextMenu: handleFilesEmptyContextMenu,
                onContextMenu: handleContextMenuEvent,
              }}
              loadError={{
                loading: browser.loading, error: browser.error,
                onDismissError: () => browser.setError(null),
              }}
              touch={{
                onEntryTouchStart: handleEntryTouchStart,
                onEntryTouchMove: handleEntryTouchMove,
                onEntryTouchEnd: handleEntryTouchEnd,
              }}
              viewMode={viewPref.viewMode}
              canWrite={browser.canWrite}
              favorites={favorites}
              onPreview={(entry) => {
                if (isPreviewableFile(entry.name)) fileActions.setPreviewEntry(entry);
                else fileCommands.handleDownload(entry);
              }}
              fileGridRef={fileGridRef as React.RefObject<HTMLDivElement>}
              rubberBandStyle={rubberBandStyle}
            />
          )}
          {nav.activeView === 'jobs' && (
            <JobsPage
              jobs={browser.jobs}
              completedCollapsed={completedCollapsed} setCompletedCollapsed={setCompletedCollapsed}
              onCancel={handleCancelJob} onPause={handlePauseJob}
              onResume={handleResumeJob} onRetry={handleRetryJob}
              onClearCompleted={handleClearCompleted} onClearFailed={handleClearFailed}
              onJobsEmptyContextMenu={handleJobsEmptyContextMenu}
            />
          )}
          {nav.activeView === 'settings' && (
            <SettingsPanel
              onOpenShares={() => { nav.setShowingSettings(false); dialogs.setSharesOpen(true); }}
              wallpaper={wallpaper.wallpaper}
              onWallpaperChange={wallpaper.setWallpaper}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onOpenShortcuts={() => fileActions.setShortcutsOpen(true)}
              onLogout={onLogout}
              session={session}
            />
          )}

          {fileActions.contextMenu && (
            <FileContextMenu
              x={fileActions.contextMenu.x} y={fileActions.contextMenu.y}
              caps={{
                canWrite: browser.canWrite, canPreview: selection.canPreview,
                canInfo: selection.canInfo, canDownload: selection.canDownload,
                canRename: selection.canRename, canArchive: selection.canArchive,
                canExtract: selection.canExtract, canChecksum: selection.canChecksum,
                canCopy: selection.canCopy, canMove: selection.canMove,
                canPaste: selection.canPaste, canDelete: selection.canDelete,
                canAnalyze: selection.canAnalyze,
              }}
              isFavorited={selectedEntryIsFavorited}
              selectedCount={selection.selectedEntries.length}
              onPreview={fileCommands.handlePreview}
              onShowInfo={fileCommands.handleShowInfo}
              onDownload={fileCommands.handleDownload}
              onRename={fileCommands.handleRename}
              onBatchRename={fileCommands.handleBatchRename}
              onCopy={fileCommands.handleCopy} onMove={fileCommands.handleMove}
              onArchive={fileCommands.handleCreateArchive}
              onExtract={fileCommands.handleExtractArchive}
              onChecksum={fileCommands.handleCreateChecksum}
              onPaste={fileCommands.handlePaste}
              onQuickShare={fileCommands.handleQuickShare}
              onShare={() => {
                const e = fileActions.contextMenu!.entry;
                if (e) dialogs.setShareDialogPath({ path: e.path, name: e.name });
              }}
              onAnalyze={fileCommands.handleAnalyze}
              onToggleFavorite={() => {
                const e = fileActions.contextMenu!.entry;
                if (e) {
                  if (favorites.includes(e.path)) removeFavorite(e.path);
                  else addFavorite(e.path);
                }
              }}
              onDelete={fileCommands.handleDelete}
              onClose={() => fileActions.setContextMenu(null)}
            />
          )}
          {trashContextMenu && browser.canWrite && (
            <TrashContextMenu
              x={trashContextMenu.x} y={trashContextMenu.y}
              onRestore={() => fileCommands.handleRestoreTrash(trashContextMenu.entry)}
              onDeletePermanently={() => fileCommands.handleDeleteTrash(trashContextMenu.entry)}
              onClose={() => setTrashContextMenu(null)}
            />
          )}
          {desktopContextMenu && (
            <DesktopContextMenu
              x={desktopContextMenu.x} y={desktopContextMenu.y}
              item={desktopContextMenu.item}
              trashCount={browser.trashEntries.length}
              onRefresh={handleRefreshDesktop}
              onEmptyTrash={handleEmptyTrash}
              onRemoveFavorite={handleRemoveDesktopFavorite}
              onAddService={() => handleOpenServiceForm()}
              onEditService={(id) => {
                const svc = services.find((s) => s.id === id);
                if (svc) handleOpenServiceForm(svc);
              }}
              onRemoveService={handleRemoveService}
              onClose={() => setDesktopContextMenu(null)}
            />
          )}
          {filesEmptyMenu && (
            <FilesEmptyMenu
              x={filesEmptyMenu.x} y={filesEmptyMenu.y}
              canWrite={browser.canWrite}
              canPaste={selection.canPaste}
              onCreateFolder={fileCommands.handleCreateFolder}
              onCreateFile={fileCommands.handleCreateFile}
              onUpload={() => fileInputRef.current?.click()}
              onRefresh={refresh}
              onPaste={() => { setFilesEmptyMenu(null); fileCommands.handlePaste(); }}
              onClose={() => setFilesEmptyMenu(null)}
            />
          )}
          {trashEmptyMenu && (
            <TrashEmptyMenu
              x={trashEmptyMenu.x} y={trashEmptyMenu.y}
              canPaste={selection.canPaste}
              onRefresh={() => { refresh(); toast.showToastObj({ title: 'Refreshed', variant: 'success' }); }}
              onPaste={() => { setTrashEmptyMenu(null); fileCommands.handlePaste(); }}
              onClose={() => setTrashEmptyMenu(null)}
            />
          )}
          {jobsEmptyMenu && (
            <JobsEmptyMenu
              x={jobsEmptyMenu.x} y={jobsEmptyMenu.y}
              onRefresh={() => { void getJobs().then((r) => browser.setJobs(r.jobs ?? [])); toast.showToastObj({ title: 'Refreshed', variant: 'success' }); }}
              onClose={() => setJobsEmptyMenu(null)}
            />
          )}
        </section>

        <StatusBar
          visible={showStatusBar}
          totalItems={nav.activeView === 'trash' ? browser.trashEntries.length : browser.entries.length}
          selectedCount={nav.activeView === 'trash' ? selection.selectedTrashIds.length : selection.selectedPaths.length}
          totalBytes={browser.selectedFileBytes}
          rootAvail={browser.currentRoot?.freeBytes ?? null}
          rootSize={browser.currentRoot?.totalBytes ?? null}
          rootLabel={browser.currentRoot?.label || browser.currentRoot?.path || ''}
          currentPath={viewPref.currentPath}
          viewContext={nav.activeView}
          trashCount={browser.trashEntries.length}
        />
      </main>
      <ToastViewport toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );

  // ── Overlay rendering ────────────────────────────────────

  return (
    <>
      {shell}
      {fileActions.previewEntry && <PreviewModal entry={fileActions.previewEntry} onClose={() => fileActions.setPreviewEntry(null)} onDownload={() => fileCommands.handleDownload(fileActions.previewEntry!)} />}
      {fileActions.infoEntry && <InfoPanel entry={fileActions.infoEntry} onClose={() => fileActions.setInfoEntry(null)} onRefresh={refresh} />}
      {fileActions.batchRenameOpen && <BatchRenameModal entries={selection.selectedEntries} onClose={() => fileActions.setBatchRenameOpen(false)} onDone={() => { toast.showToastObj({ title: 'Items renamed', variant: 'success' }); refresh(); }} />}
      {dialogs.confirmDialog && <ConfirmDialog dialog={dialogs.confirmDialog} onClose={() => dialogs.setConfirmDialog(null)} />}
      {dialogs.textInputDialog && <TextInputDialog dialog={dialogs.textInputDialog} onClose={() => dialogs.setTextInputDialog(null)} />}
      {dialogs.transferDialog && <TransferDialog dialog={dialogs.transferDialog} folderSuggestions={browser.folderSuggestions} onClose={() => dialogs.setTransferDialog(null)} onSubmit={fileCommands.handleTransferSubmit} />}
      {dialogs.shareDialogPath && <ShareDialog path={dialogs.shareDialogPath.path} name={dialogs.shareDialogPath.name} onClose={() => dialogs.setShareDialogPath(null)} />}
      {fileActions.shortcutsOpen && <KeyboardShortcuts onClose={() => fileActions.setShortcutsOpen(false)} />}
      {dialogs.sharesOpen && <ShareManager onClose={() => dialogs.setSharesOpen(false)} />}
      {fileActions.analyzePath && <DiskUsageAnalyzer path={fileActions.analyzePath} onClose={() => fileActions.setAnalyzePath(null)} />}
      {serviceFormData && (
        <ServiceFormModal
          initial={serviceFormData.initial}
          onSave={handleSaveService}
          onClose={() => setServiceFormData(null)}
        />
      )}
    </>
  );
}
