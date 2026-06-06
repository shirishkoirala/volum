import { KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileEntry,
  getJobs,
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
import { DrivesView } from '../pages/DrivesView';
import { TrashView } from '../pages/TrashView';
import { JobsPage } from '../pages/JobsPage';
import { ProgressBar } from '../components/ui/ProgressBar';
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
import { useContextMenus } from '../hooks/useContextMenus';
import { useNavStack } from '../hooks/useNavStack';
import { useDesktopActions } from '../hooks/useDesktopActions';
import type { UploadProgress } from '../utils/upload';
import { formatBytes } from '../utils/format';
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
  const [pendingUploadCount, setPendingUploadCount] = useState(0);

  const nav = useNavigation(browser.devices, browser.jobs, browser.trashEntries.length, viewPref.currentPath, pendingUploadCount);
  const { favorites, addFavorite, removeFavorite } = useFavorites(viewPref.currentPath);
  const wallpaper = useWallpaper();
  const { services, addService, updateService, removeService } = useServiceShortcuts();
  const fileActions = useFileActions();
  const dialogs = useDialogStack();

  // ── Local state and refs ──
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileGridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressEntry = useRef<{ entry: FileEntry; x: number; y: number } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Extracted behavior hooks ──
  const menus = useContextMenus();
  const navActions = useNavStack({ viewPref, nav, browser });
  const selection = useSelection({
    filteredEntries: browser.filteredEntries,
    trashEntries: browser.trashEntries,
    favorites,
    canWrite: browser.canWrite,
    currentPath: viewPref.currentPath,
  });

  const desktopActions = useDesktopActions({
    browser, dialogs, toast, nav,
    viewPref: { currentPath: viewPref.currentPath, setCurrentPath: viewPref.setCurrentPath },
    selection,
    removeFavorite, addService, updateService, removeService,
    serviceFormData: menus.serviceFormData,
    setDesktopContextMenu: menus.setDesktopContextMenu,
    setServiceFormData: menus.setServiceFormData,
    refresh: navActions.refresh,
    navigateTo: navActions.navigateTo,
    resetToDesktopView: navActions.resetToDesktopView,
  });

  const fileCommands = useFileCommands({
    currentPath: viewPref.currentPath,
    canWrite: browser.canWrite,
    folderSuggestions: browser.folderSuggestions,
    refresh: navActions.refresh,
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
    setTrashContextMenu: menus.setTrashContextMenu,
    setFilesEmptyMenu: menus.setFilesEmptyMenu,
    setUploadProgress,
    setPendingUploadCount,
    showToastObj: toast.showToastObj,
    contextMenu: fileActions.contextMenu,
    navigateTo: navActions.navigateTo,
    selectedTrashIds: selection.selectedTrashIds,
    setSelectedTrashIds: selection.setSelectedTrashIds,
    setLastSelectedTrashId: selection.setLastSelectedTrashId,
    emptyMenuBlockedRef: menus.emptyMenuBlockedRef,
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
      menus.setTrashContextMenu(null);
      menus.setDesktopContextMenu(null);
      menus.setFilesEmptyMenu(null);
      menus.setTrashEmptyMenu(null);
      menus.setJobsEmptyMenu(null);
    };
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    return () => { window.removeEventListener('click', closeMenus); window.removeEventListener('resize', closeMenus); };
  }, [fileActions, menus]);

  useEffect(() => { if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission(); }, []);

  // ── Handlers ─────────────────────────────────────────────

  const handleContextMenuEvent = useCallback((entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    menus.emptyMenuBlockedRef.current = true;
    queueMicrotask(() => { menus.emptyMenuBlockedRef.current = false; });
    if (fileActions.renaming) return;
    if (!selection.selectedPaths.includes(entry.path)) {
      selection.setSelectedPaths([entry.path]);
      selection.setLastSelectedPath(entry.path);
    }
    fileActions.setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }, [fileActions, selection, menus]);

  const handleFilesEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (menus.emptyMenuBlockedRef.current) { menus.emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    fileActions.setContextMenu(null);
    menus.setFilesEmptyMenu({ x: event.clientX, y: event.clientY });
  }, [fileActions, menus]);

  const handleTrashEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (menus.emptyMenuBlockedRef.current) { menus.emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    menus.setTrashContextMenu(null);
    menus.setTrashEmptyMenu({ x: event.clientX, y: event.clientY });
  }, [menus]);

  const handleJobsEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (menus.emptyMenuBlockedRef.current) { menus.emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    menus.setJobsEmptyMenu({ x: event.clientX, y: event.clientY });
  }, [menus]);

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
    menus.setDesktopContextMenu({ x: event.clientX, y: event.clientY, item });
  }, [menus]);

  // ── Drag & Drop / Rubber band ────────────────────────────

  const dragDrop = useDragDrop(
    browser.canWrite,
    browser.filteredEntries,
    selection.selectedPaths,
    dialogs.setTransferDialog,
    fileCommands.handleUploadFiles,
    (message) => {
      browser.setError(message);
      toast.showToastObj({ title: 'Upload failed', message, variant: 'error' });
    },
  );
  const { rubberBandStyle, handleFileAreaMouseDown } = useRubberBand(browser.filteredEntries, selection.setSelectedPaths, selection.setLastSelectedPath, fileGridRef);

  // ── Derived data ─────────────────────────────────────────

  const showStatusBar = nav.activeView !== 'settings' && nav.activeView !== 'jobs' && nav.activeView !== 'desktop' && nav.activeView !== 'drives';
  const selectedEntryIsFavorited = fileActions.contextMenu?.entry ? favorites.includes(fileActions.contextMenu.entry.path) : selection.isFavorited;
  const canUpload = nav.activeView === 'files' && browser.canWrite && Boolean(viewPref.currentPath);

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

  const openUploadPicker = useCallback(() => {
    const input = uploadFileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  }, []);

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
        <input
          ref={uploadFileInputRef}
          type="file"
          multiple
          className={styles.hiddenFileInput}
          onChange={(event) => {
            const { files } = event.currentTarget;
            try {
              if (files && files.length > 0) {
                fileCommands.handleUploadFiles(files);
              }
            } finally {
              event.currentTarget.value = '';
            }
          }}
        />
        <TopBar
          activeView={nav.activeView}
          title={nav.topBarTitle}
          onGoDesktop={navActions.resetToDesktopView}
          onOpenSettings={() => { nav.setShowingSettings(true); nav.setShowingTrash(false); nav.setShowingJobs(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null); }}
          session={session}
          onLogout={onLogout}
          menuHandlers={{
            onCreateFolder: fileCommands.handleCreateFolder,
            onUpload: openUploadPicker,
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
            onGoDesktop: navActions.resetToDesktopView,
            onGoFiles: () => { nav.setShowingMyPC(false); desktopActions.handleDockActivate('files'); },
            onGoTrash: () => {
              viewPref.setCurrentPath('');
              nav.setShowingTrash(true); nav.setShowingSettings(false); nav.setShowingJobs(false);
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
            canUpload,
            selectedCount: nav.showingTrash ? selection.selectedTrashIds.length : selection.selectedPaths.length,
          }}
        />
        <Dock items={nav.dockItems} onActivate={desktopActions.handleDockActivate} />

        <section className={styles.workspace} onClick={selection.handleWorkspaceClick}>
          {nav.activeView === 'desktop' && (
            <DesktopView
              trashEntries={browser.trashEntries} jobs={browser.jobs}
              pendingTransferCount={pendingUploadCount}
              favorites={favorites} services={services}
              onNavigateTo={navActions.navigateTo}
              onNavigateToTrash={desktopActions.handleDesktopNavigateToTrash}
              onOpenSettings={() => { nav.setShowingSettings(true); nav.setShowingTrash(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null); }}
              onOpenJobs={() => { nav.setShowingJobs(true); nav.setShowingSettings(false); nav.setShowingTrash(false); nav.setShowingMyPC(false); nav.setSelectedDriveName(null); }}
              onOpenFiles={() => desktopActions.handleDockActivate('files')}
              onShowMyPC={() => nav.setShowingMyPC(true)}
              wallpaperStyle={wallpaper.wallpaperStyle}
              onItemContextMenu={handleDesktopItemContextMenu}
            />
          )}
          {nav.activeView === 'drives' && (
            <DrivesView
              devices={browser.devices}
              selectedDriveName={nav.selectedDriveName}
              onSelectDrive={nav.setSelectedDriveName}
              onBackToDesktop={desktopActions.handleBackToDesktop}
              onNavigateTo={navActions.navigateTo}
              deviceError={browser.deviceError}
              onRetryDevices={browser.loadDevices}
              wallpaperStyle={wallpaper.wallpaperStyle}
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
                onNavigate: navActions.navigateTo,
                onBack: navActions.goBack,
                locationMode: fileActions.locationMode,
                onLocationNavigate: (path: string) => navActions.navigateTo(path.startsWith('/') ? path : `/${path}`),
                onToggleLocationMode: () => fileActions.setLocationMode((v) => !v),
              }}
              search={{
                query: browser.query, searchOpen: browser.searchOpen, searchResults: browser.searchResults,
                onSearch: (q) => { browser.setQuery(q); if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => browser.handleGlobalSearch(q), 200); browser.setSearchOpen(true); },
                onClearSearch: () => { browser.setQuery(''); browser.setSearchResults(null); browser.setSearchOpen(false); },
                onSearchResultClick: (result) => {
                  if (result.type === 'directory') navActions.navigateTo(result.path);
                  else { const idx = result.path.lastIndexOf('/'); navActions.navigateTo(idx < 0 ? '/' : result.path.substring(0, idx) || '/'); }
                },
                onUploadClick: openUploadPicker,
                canUpload,
                searchRef: searchRef as React.RefObject<HTMLInputElement>,
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
          {menus.trashContextMenu && browser.canWrite && (
            <TrashContextMenu
              x={menus.trashContextMenu.x} y={menus.trashContextMenu.y}
              onRestore={() => fileCommands.handleRestoreTrash(menus.trashContextMenu!.entry)}
              onDeletePermanently={() => fileCommands.handleDeleteTrash(menus.trashContextMenu!.entry)}
              onClose={() => menus.setTrashContextMenu(null)}
            />
          )}
          {menus.desktopContextMenu && (
            <DesktopContextMenu
              x={menus.desktopContextMenu.x} y={menus.desktopContextMenu.y}
              item={menus.desktopContextMenu.item}
              trashCount={browser.trashEntries.length}
              onRefresh={desktopActions.handleRefreshDesktop}
              onEmptyTrash={desktopActions.handleEmptyTrash}
              onRemoveFavorite={desktopActions.handleRemoveDesktopFavorite}
              onAddService={() => desktopActions.handleOpenServiceForm()}
              onEditService={(id) => {
                const svc = services.find((s) => s.id === id);
                if (svc) desktopActions.handleOpenServiceForm(svc);
              }}
              onRemoveService={desktopActions.handleRemoveService}
              onClose={() => menus.setDesktopContextMenu(null)}
            />
          )}
          {menus.filesEmptyMenu && (
            <FilesEmptyMenu
              x={menus.filesEmptyMenu.x} y={menus.filesEmptyMenu.y}
              canWrite={browser.canWrite}
              canUpload={canUpload}
              canPaste={selection.canPaste}
              onCreateFolder={fileCommands.handleCreateFolder}
              onCreateFile={fileCommands.handleCreateFile}
              onUpload={openUploadPicker}
              onRefresh={navActions.refresh}
              onPaste={() => { menus.setFilesEmptyMenu(null); fileCommands.handlePaste(); }}
              onClose={() => menus.setFilesEmptyMenu(null)}
            />
          )}
          {menus.trashEmptyMenu && (
            <TrashEmptyMenu
              x={menus.trashEmptyMenu.x} y={menus.trashEmptyMenu.y}
              canPaste={selection.canPaste}
              onRefresh={() => { navActions.refresh(); toast.showToastObj({ title: 'Refreshed', variant: 'success' }); }}
              onPaste={() => { menus.setTrashEmptyMenu(null); fileCommands.handlePaste(); }}
              onClose={() => menus.setTrashEmptyMenu(null)}
            />
          )}
          {menus.jobsEmptyMenu && (
            <JobsEmptyMenu
              x={menus.jobsEmptyMenu.x} y={menus.jobsEmptyMenu.y}
              onRefresh={() => { void getJobs().then((r) => browser.setJobs(r.jobs ?? [])); toast.showToastObj({ title: 'Refreshed', variant: 'success' }); }}
              onClose={() => menus.setJobsEmptyMenu(null)}
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
      {uploadProgress && (
        <div className={styles.uploadProgress} role="status" aria-live="polite">
          <div className={styles.uploadProgressHeader}>
            <strong>Uploading</strong>
            <span>{Math.round(uploadProgress.total > 0 ? (uploadProgress.received / uploadProgress.total) * 100 : 0)}%</span>
          </div>
          <span className={styles.uploadProgressName}>{uploadProgress.filename}</span>
          <ProgressBar
            value={uploadProgress.total > 0 ? (uploadProgress.received / uploadProgress.total) * 100 : 0}
            ariaLabel="Upload progress"
          />
          <span className={styles.uploadProgressMeta}>
            {formatBytes(uploadProgress.received)} of {formatBytes(uploadProgress.total)}
          </span>
        </div>
      )}
      <ToastViewport toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );

  // ── Overlay rendering ────────────────────────────────────

  return (
    <>
      {shell}
      {fileActions.previewEntry && <PreviewModal entry={fileActions.previewEntry} onClose={() => fileActions.setPreviewEntry(null)} onDownload={() => fileCommands.handleDownload(fileActions.previewEntry!)} />}
      {fileActions.infoEntry && <InfoPanel entry={fileActions.infoEntry} onClose={() => fileActions.setInfoEntry(null)} onRefresh={navActions.refresh} />}
      {fileActions.batchRenameOpen && <BatchRenameModal entries={selection.selectedEntries} onClose={() => fileActions.setBatchRenameOpen(false)} onDone={() => { toast.showToastObj({ title: 'Items renamed', variant: 'success' }); navActions.refresh(); }} />}
      {dialogs.confirmDialog && <ConfirmDialog dialog={dialogs.confirmDialog} onClose={() => dialogs.setConfirmDialog(null)} />}
      {dialogs.textInputDialog && <TextInputDialog dialog={dialogs.textInputDialog} onClose={() => dialogs.setTextInputDialog(null)} />}
      {dialogs.transferDialog && <TransferDialog dialog={dialogs.transferDialog} folderSuggestions={browser.folderSuggestions} onClose={() => dialogs.setTransferDialog(null)} onSubmit={fileCommands.handleTransferSubmit} />}
      {dialogs.shareDialogPath && <ShareDialog path={dialogs.shareDialogPath.path} name={dialogs.shareDialogPath.name} onClose={() => dialogs.setShareDialogPath(null)} />}
      {fileActions.shortcutsOpen && <KeyboardShortcuts onClose={() => fileActions.setShortcutsOpen(false)} />}
      {dialogs.sharesOpen && <ShareManager onClose={() => dialogs.setSharesOpen(false)} />}
      {fileActions.analyzePath && <DiskUsageAnalyzer path={fileActions.analyzePath} onClose={() => fileActions.setAnalyzePath(null)} />}
      {menus.serviceFormData && (
        <ServiceFormModal
          initial={menus.serviceFormData.initial}
          onSave={desktopActions.handleSaveService}
          onClose={() => menus.setServiceFormData(null)}
        />
      )}
    </>
  );
}
