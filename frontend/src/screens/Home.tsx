import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortField, SortDirection } from '../types';
import type { FileEntry, Session } from '../api/client';
import { KeyboardShortcuts } from '../components/overlay/KeyboardShortcuts';
import { ShareDialog } from '../components/overlay/ShareDialog';
import { ShareManager } from '../components/overlay/ShareManager';
import { ServiceFormModal } from '../components/overlay/ServiceFormModal';
import { PreviewModal } from '../components/overlay/PreviewModal';
import { SettingsPanel } from '../pages/SettingsPanel';
import { TopBar } from '../components/layout/TopBar';
import { Dock } from '../components/layout/Dock';
import { StatusBar } from '../components/layout/StatusBar';
import { FilesView } from '../pages/FilesView';
import { DesktopView } from '../pages/DesktopView';
import { DrivesView } from '../pages/DrivesView';
import { TrashView } from '../pages/TrashView';
import { SearchResultsView } from '../pages/SearchResultsView';
import { JobsPage } from '../pages/JobsPage';
import { ToastViewport } from '../components/overlay/Toast';
import { WindowHost } from '../components/window/WindowHost';
import { DesktopContextMenu } from '../components/overlay/DesktopContextMenu';
import type { DesktopIconItem } from '../pages/DesktopView';
import type { ServiceHealthResult } from '../utils/services';
import { useServiceShortcuts } from '../hooks/useServiceShortcuts';
import { useJobs } from '../hooks/useJobs';
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
import { useWorkspaceOpeners } from '../hooks/useWorkspaceOpeners';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWindowManager, type WindowState } from '../contexts/WindowManager';
import { CommandsContext, type WindowCommands } from '../contexts/WindowCommands';
import { ShellContext } from '../contexts/ShellContext';
import { Taskbar } from '../components/layout/Taskbar';
import { PreviewWindow } from '../components/window/PreviewWindow';
import { ServiceWindow } from '../components/window/ServiceWindow';
import { fileTypeIconUrl } from '../api/icons';
import { openFileExternally } from '../utils/preview';
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

  // SSE connection for job badges (dock + desktop). Action handlers unused — JobsPage has its own.
  useJobs(browser.setJobs, {
    session,
    sessionLoading: false,
    onRefresh: browser.refresh,
    showToast: toast.showToast,
  });
  const [pendingUploadCount, setPendingUploadCount] = useState(0);

  const nav = useNavigation(browser.devices, browser.jobs, browser.trashEntries.length, viewPref.currentPath, pendingUploadCount);
  const { favorites, addFavorite, removeFavorite } = useFavorites(viewPref.currentPath);
  const wallpaper = useWallpaper();
  const { services, health: serviceHealth, addService, updateService, removeService, refreshHealth: refreshServiceHealth } = useServiceShortcuts();
  const fileActions = useFileActions();
  const dialogs = useDialogStack();
  const [previewEntries, setPreviewEntries] = useState<FileEntry[]>([]);

  const isMobile = useIsMobile();

  // ── Refs ──
  const filesViewRef = useRef<import('../pages/FilesView').FilesViewHandle>(null);
  const prevHealthRef = useRef<Record<string, ServiceHealthResult>>({});

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

  const wm = useWindowManager();
  const defaultRootPath = useMemo(
    () => browser.roots.find((root) => root.available)?.path ?? browser.roots[0]?.path ?? '/',
    [browser.roots],
  );

  const workspaceOpeners = useWorkspaceOpeners({
    defaultRootPath,
    isMobile,
    nav,
    navActions,
    setPreviewEntry: fileActions.setPreviewEntry,
    setPreviewEntries,
    trashCount: browser.trashEntries.length,
    wm,
  });

  const showToastFn = toast.showToast;
  useEffect(() => {
    const hasHealthChecks = services.some((service) => service.healthUrl);
    if (!hasHealthChecks) return;

    const shouldRefresh = () => nav.activeView === 'desktop' && document.visibilityState === 'visible';

    async function checkHealth() {
      const prev = prevHealthRef.current;
      const next = await refreshServiceHealth();
      if (!next) return;
      prevHealthRef.current = next;
      for (const [id, result] of Object.entries(next)) {
        const prevResult = prev[id];
        if (!prevResult || !result) continue;
        if (prevResult.status === 'unhealthy' && result.status === 'healthy') {
          const svc = services.find((s) => s.id === id);
          if (svc) showToastFn(`${svc.name} recovered`, 'success');
        } else if (prevResult.status !== 'unhealthy' && result.status === 'unhealthy') {
          const svc = services.find((s) => s.id === id);
          if (svc) {
            showToastFn(`${svc.name} health check failed`, 'error');
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`${svc.name} health check failed`, { body: result.error ?? 'Service is unreachable' });
            }
          }
        }
      }
    }

    if (shouldRefresh()) {
      void checkHealth();
    }

    const handleVisibilityChange = () => {
      if (shouldRefresh()) void checkHealth();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = window.setInterval(() => {
      if (shouldRefresh()) void checkHealth();
    }, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [services, nav.activeView, refreshServiceHealth, showToastFn]);

  // ── Desktop actions ──────────────────────────────────────
  const desktopActions = useDesktopActions({
    browser, dialogs, toast, nav,
    viewPref: { currentPath: viewPref.currentPath, setCurrentPath: viewPref.setCurrentPath },
    selection,
    removeFavorite, addService, updateService, removeService,
    refreshServiceHealth,
    serviceFormData: menus.serviceFormData,
    setDesktopContextMenu: menus.setDesktopContextMenu,
    setServiceFormData: menus.setServiceFormData,
    refresh: navActions.refresh,
    navigateTo: navActions.navigateTo,
    resetToDesktopView: navActions.resetToDesktopView,
  });

  // ── Render window content from type+params ──────────────
  const renderWindow = useCallback((win: WindowState) => {
    switch (win.winType) {
      case 'files':
        return (
          <FilesView
            currentPath={(win.params.path as string) || defaultRootPath}
            session={session}
            favorites={favorites}
            onNavigate={navActions.navigateTo}
            onBack={navActions.goBack}
            onAddFavorite={addFavorite}
            onRemoveFavorite={removeFavorite}
            onPreview={workspaceOpeners.openPreview}
          />
        );
      case 'trash':
        return <TrashView />;
      case 'drives':
        return <DrivesView onBackToDesktop={() => wm.closeWindow(win.id)} />;
      case 'jobs':
        return <JobsPage session={session} sessionLoading={false} />;
      case 'settings':
        return (
          <SettingsPanel
            onOpenShares={() => dialogs.setSharesOpen(true)}
            wallpaper={wallpaper.wallpaper}
            onWallpaperChange={wallpaper.setWallpaper}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenShortcuts={() => fileActions.setShortcutsOpen(true)}
            onLogout={onLogout}
            session={session}
            services={services}
            serviceHealth={serviceHealth}
            onAddService={() => desktopActions.handleOpenServiceForm()}
            onEditService={(id) => {
              const svc = services.find((s) => s.id === id);
              if (svc) desktopActions.handleOpenServiceForm(svc);
            }}
            onRemoveService={desktopActions.handleRemoveService}
          />
        );
      case 'preview': {
        const entry = win.params.entry as FileEntry | undefined;
        const entries = Array.isArray(win.params.entries) ? win.params.entries as FileEntry[] : entry ? [entry] : [];
        if (!entry) return null;
        return (
          <PreviewWindow
            entry={entry}
            entries={entries}
            onShare={(shareEntry) => dialogs.setShareDialogPath({ path: shareEntry.path, name: shareEntry.name })}
            onSelectEntry={(nextEntry) => {
              wm.toggleWindow('preview', {
                title: nextEntry.name,
                icon: fileTypeIconUrl(nextEntry),
                winType: 'preview',
                params: { entry: nextEntry, entries },
                width: win.width,
                height: win.height,
                x: win.x,
                y: win.y,
              });
            }}
          />
        );
      }
      case 'service': {
        const name = typeof win.params.name === 'string' ? win.params.name : win.title;
        const url = typeof win.params.url === 'string' ? win.params.url : '';
        if (!url) return null;
        return <ServiceWindow name={name} url={url} />;
      }
      default:
        return null;
    }
  }, [session, favorites, navActions, addFavorite, removeFavorite, wallpaper, theme, onToggleTheme, onLogout, dialogs, fileActions, defaultRootPath, wm, workspaceOpeners.openPreview, services, serviceHealth, desktopActions]);

  const previewIndex = fileActions.previewEntry
    ? previewEntries.findIndex((entry) => entry.path === fileActions.previewEntry?.path)
    : -1;
  const previewPositionLabel = previewIndex >= 0 ? `${previewIndex + 1} of ${previewEntries.length}` : undefined;
  const previousPreviewEntry = previewIndex > 0 ? previewEntries[previewIndex - 1] : undefined;
  const nextPreviewEntry = previewIndex >= 0 && previewIndex < previewEntries.length - 1 ? previewEntries[previewIndex + 1] : undefined;

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
    setPendingUploadCount,
    setUploadProgress: () => {},
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
      if (e.key === '?' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); fileActions.setShortcutsOpen((p) => !p); }
      if (e.key === 'Escape' && fileActions.shortcutsOpen) { fileActions.setShortcutsOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileActions]);

  useEffect(() => {
    const closeMenus = () => {
      menus.setTrashContextMenu(null);
      menus.setDesktopContextMenu(null);
      menus.setTrashEmptyMenu(null);
      menus.setJobsEmptyMenu(null);
    };
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    return () => { window.removeEventListener('click', closeMenus); window.removeEventListener('resize', closeMenus); };
  }, [menus]);

  useEffect(() => { if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission(); }, []);

  // ── Desktop handlers ─────────────────────────────────────
  const handleDesktopItemContextMenu = useCallback((item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    menus.setDesktopContextMenu({ x: event.clientX, y: event.clientY, item });
  }, [menus]);

  // ── Derived data ─────────────────────────────────────────

  const showStatusBar = !isMobile ? false : nav.activeView === 'trash';

  // ── Taskbar launcher handler ─────────────────────────────
  const handleTaskbarLauncher = useCallback((id: string) => {
    if (id === 'files') workspaceOpeners.openFiles();
    else if (id === 'trash') workspaceOpeners.openTrash();
    else if (id === 'jobs') workspaceOpeners.openJobs();
    else if (id === 'settings') workspaceOpeners.openSettings();
    else if (id === 'drives') workspaceOpeners.openDrives();
    else if (id === 'desktop') workspaceOpeners.openDesktop();
    else desktopActions.handleDockActivate(id);
  }, [workspaceOpeners, desktopActions]);

  // ── Focused window & reactive commands ──────────────────
  const [commandsMap, setCommandsMap] = useState<Record<string, WindowCommands>>({});
  const registerCommands = useCallback((id: string, cmds: WindowCommands) => {
    setCommandsMap(prev => {
      const existing = prev[id];
      if (existing &&
          existing.onCreateFolder === cmds.onCreateFolder &&
          existing.onUpload === cmds.onUpload &&
          existing.onCut === cmds.onCut &&
          existing.onCopy === cmds.onCopy &&
          existing.onPaste === cmds.onPaste &&
          existing.onSelectAll === cmds.onSelectAll &&
          existing.onInvertSelection === cmds.onInvertSelection &&
          existing.onRename === cmds.onRename &&
          existing.onDelete === cmds.onDelete &&
          existing.onRestore === cmds.onRestore &&
          existing.onDeleteForever === cmds.onDeleteForever &&
          existing.onEmptyTrash === cmds.onEmptyTrash &&
          existing.canWrite === cmds.canWrite &&
          existing.canUpload === cmds.canUpload &&
          existing.selectedCount === cmds.selectedCount) {
        return prev;
      }
      return { ...prev, [id]: cmds };
    });
  }, []);
  const unregisterCommands = useCallback((id: string) => {
    setCommandsMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const focusedWindow = useMemo(() => {
    const visibleWindows = wm.windows.filter((win) => !win.minimized);
    if (visibleWindows.length === 0) return null;
    return visibleWindows.reduce((a, b) => (a.zIndex > b.zIndex ? a : b));
  }, [wm.windows]);

  const focusedCommands = focusedWindow ? (commandsMap[focusedWindow.id] ?? {}) : {} as WindowCommands;
  const topBarTitle = !isMobile
    ? (focusedWindow?.title ?? nav.topBarTitle ?? 'Desktop')
    : (nav.topBarTitle);

  // ── Shell context value ────────────────────────────────
  const shellContext = useMemo(() => ({
    showToast: toast.showToast,
    showToastObj: toast.showToastObj,
    navigateTo: navActions.navigateTo,
    refresh: browser.refresh,
  }), [toast.showToast, toast.showToastObj, navActions.navigateTo, browser.refresh]);

  // ── Shell JSX ────────────────────────────────────────────

  const shell = (
    <>
      <main className={`${styles.appShell}${showStatusBar ? ` ${styles.withShellStatus}` : ''}`}>
        <CommandsContext.Provider value={{ commands: commandsMap, register: registerCommands, unregister: unregisterCommands }}>
        <ShellContext.Provider value={shellContext}>
        <TopBar
          activeView={nav.activeView}
          title={topBarTitle}
          onGoDesktop={navActions.resetToDesktopView}
          onOpenSettings={workspaceOpeners.openSettings}
          session={session}
          onLogout={onLogout}
          focusedWindowType={focusedWindow?.winType ?? null}
          focusedWindowExists={!isMobile && focusedWindow !== null}
          menuHandlers={{
            onCreateFolder: focusedCommands.onCreateFolder ?? (() => filesViewRef.current?.handleCreateFolder()),
            onUpload: focusedCommands.onUpload ?? (() => filesViewRef.current?.handleUpload()),
            onCut: focusedCommands.onCut ?? (() => filesViewRef.current?.handleCut()),
            onCopy: focusedCommands.onCopy ?? (() => filesViewRef.current?.handleCopy()),
            onPaste: focusedCommands.onPaste ?? (() => filesViewRef.current?.handlePaste()),
            onSelectAll: focusedCommands.onSelectAll ?? (() => filesViewRef.current?.handleSelectAll()),
            onInvertSelection: focusedCommands.onInvertSelection ?? (() => filesViewRef.current?.handleInvertSelection()),
            onRename: focusedCommands.onRename ?? (() => filesViewRef.current?.handleRename()),
            onDelete: focusedCommands.onDelete ?? (() => filesViewRef.current?.handleDelete()),
            onRestore: focusedCommands.onRestore,
            onDeleteForever: focusedCommands.onDeleteForever,
            onEmptyTrash: focusedCommands.onEmptyTrash,
            onClose: focusedWindow ? () => wm.closeWindow(focusedWindow.id) : navActions.resetToDesktopView,
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
            onGoFiles: () => workspaceOpeners.openFiles(),
            onGoTrash: workspaceOpeners.openTrash,
            onGoJobs: workspaceOpeners.openJobs,
            onGoSettings: workspaceOpeners.openSettings,
            onToggleLocation: () => filesViewRef.current?.handleToggleLocation(),
            canWrite: focusedCommands.canWrite ?? browser.canWrite,
            canUpload: focusedCommands.canUpload ?? browser.canWrite,
            selectedCount: focusedCommands.selectedCount ?? (nav.showingTrash ? selection.selectedTrashIds.length : selection.selectedPaths.length),
          }}
        />
        <Dock items={nav.dockItems} onActivate={handleTaskbarLauncher} shellStatusVisible={showStatusBar} />

        <section className={styles.workspace} onClick={selection.handleWorkspaceClick}>
          {nav.activeView === 'desktop' && (
            <DesktopView
              trashEntries={browser.trashEntries} jobs={browser.jobs}
              pendingTransferCount={pendingUploadCount}
              favorites={favorites} services={services} serviceHealth={serviceHealth}
              onNavigateTo={workspaceOpeners.openFiles}
              onNavigateToTrash={workspaceOpeners.openTrash}
              onOpenSettings={workspaceOpeners.openSettings}
              onOpenJobs={workspaceOpeners.openJobs}
              onOpenFiles={() => workspaceOpeners.openFiles()}
              onOpenService={workspaceOpeners.openService}
              onShowMyPC={workspaceOpeners.openDrives}
              wallpaperStyle={wallpaper.wallpaperStyle}
              onItemContextMenu={handleDesktopItemContextMenu}
            />
          )}
          {nav.activeView === 'drives' && (
            <DrivesView />
          )}
          {nav.activeView === 'trash' && (
            <TrashView />
          )}
          {nav.activeView === 'search' && (
            <SearchResultsView
              initialQuery={nav.searchQuery}
              session={session}
              onNavigate={navActions.navigateTo}
              onClose={() => { nav.setShowingSearch(false); navActions.resetToDesktopView(); }}
              onPreview={workspaceOpeners.openPreview}
            />
          )}
          {nav.activeView === 'files' && (
            <FilesView
              ref={filesViewRef}
              currentPath={viewPref.currentPath}
              session={session}
              favorites={favorites}
              onNavigate={navActions.navigateTo}
              onBack={navActions.goBack}
              onAddFavorite={addFavorite}
              onRemoveFavorite={removeFavorite}
              onPreview={workspaceOpeners.openPreview}
              onShowAllSearchResults={(query) => { nav.setSearchQuery(query); nav.setShowingSearch(true); }}
            />
          )}
          {nav.activeView === 'jobs' && (
            <JobsPage session={session} sessionLoading={false} />
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
              services={services}
              serviceHealth={serviceHealth}
              onAddService={() => desktopActions.handleOpenServiceForm()}
              onEditService={(id) => {
                const svc = services.find((s) => s.id === id);
                if (svc) desktopActions.handleOpenServiceForm(svc);
              }}
              onRemoveService={desktopActions.handleRemoveService}
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
        </section>

        <WindowHost renderWindow={renderWindow} />

        <Taskbar launcherItems={nav.dockItems} onActivateLauncher={handleTaskbarLauncher} />

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
        </ShellContext.Provider>
        </CommandsContext.Provider>
      </main>
      <ToastViewport toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );

  // ── Overlay rendering ────────────────────────────────────

  return (
    <>
      {shell}
      {dialogs.shareDialogPath && <ShareDialog path={dialogs.shareDialogPath.path} name={dialogs.shareDialogPath.name} onClose={() => dialogs.setShareDialogPath(null)} />}
      {fileActions.previewEntry && (
        <PreviewModal
          entry={fileActions.previewEntry}
          onClose={() => fileActions.setPreviewEntry(null)}
          onDownload={() => openFileExternally(fileActions.previewEntry!.path)}
          onShare={() => dialogs.setShareDialogPath({ path: fileActions.previewEntry!.path, name: fileActions.previewEntry!.name })}
          onPrevious={previousPreviewEntry ? () => fileActions.setPreviewEntry(previousPreviewEntry) : undefined}
          onNext={nextPreviewEntry ? () => fileActions.setPreviewEntry(nextPreviewEntry) : undefined}
          previousDisabled={!previousPreviewEntry}
          nextDisabled={!nextPreviewEntry}
          positionLabel={previewPositionLabel}
        />
      )}
      {fileActions.shortcutsOpen && <KeyboardShortcuts onClose={() => fileActions.setShortcutsOpen(false)} />}
      {dialogs.sharesOpen && <ShareManager onClose={() => dialogs.setSharesOpen(false)} />}
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
