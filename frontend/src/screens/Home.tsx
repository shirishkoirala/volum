import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortField, SortDirection } from '../types';
import type { Session } from '../api/client-auth';
import type { FileEntry } from '../api/client-files';
import type { Job } from '../api/client-jobs';
import { KeyboardShortcuts } from '../components/overlay/KeyboardShortcuts';
import { PreviewModal } from '../components/overlay/PreviewModal';
import { ShareDialog } from '../components/overlay/ShareDialog';
import { ShareManager } from '../components/overlay/ShareManager';
import { ServiceFormModal } from '../components/overlay/ServiceFormModal';
import { ConfirmDialog } from '../components/overlay/ConfirmDialog';
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
import { StorageAnalyzerView } from '../pages/StorageAnalyzerView';
import { ToastViewport } from '../components/overlay/Toast';
import { WindowHost } from '../components/window/WindowHost';
import { DesktopContextMenu } from '../components/overlay/DesktopContextMenu';
import type { DesktopIconItem } from '../hooks/useDesktopIcons';
import type { ServiceHealthResult } from '../utils/services';
import { useServiceShortcuts } from '../hooks/useServiceShortcuts';
import { useJobs } from '../hooks/useJobs';
import { useViewPreferences } from '../hooks/useViewPreferences';
import { useNavigation, type ActiveView } from '../hooks/useNavigation';
import { useFavorites } from '../hooks/useFavorites';
import { useFileActions } from '../hooks/useFileActions';
import { useDialogStack } from '../hooks/useDialogStack';
import { useToasts } from '../hooks/useToasts';
import { useFileBrowser } from '../hooks/useFileBrowser';
import { useSelection } from '../hooks/useSelection';
import { useContextMenus } from '../hooks/useContextMenus';
import { useNavStack } from '../hooks/useNavStack';
import { useDesktopActions } from '../hooks/useDesktopActions';
import { useWorkspaceOpeners } from '../hooks/useWorkspaceOpeners';
import { useIsMobile } from '../hooks/useIsMobile';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useClickOutsideMenus } from '../hooks/useClickOutsideMenus';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePreviewNavigation } from '../hooks/usePreviewNavigation';
import { useWindowManager, type WindowState } from '../contexts/WindowManager';
import { CommandsContext, type WindowCommands } from '../contexts/WindowCommands';
import { ShellContext } from '../contexts/ShellContext';
import { Taskbar } from '../components/layout/Taskbar';
import { PreviewWindow } from '../components/window/PreviewWindow';
import { ServiceWindow } from '../components/window/ServiceWindow';
import { fileTypeIconUrl, storageAnalyzerIconUrl } from '../api/icons';
import { defaultRootPath as getDefaultRootPath } from '../utils/roots';
import { openFileExternally } from '../utils/preview';
import { STANDARD_WINDOW_H, STANDARD_WINDOW_W } from '../utils/window';
import styles from './Home.module.css';

interface HomeProps {
  session: Session;
  onSessionChange: (session: Session) => void;
  onLogout: () => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

type AnalysisSection = 'disk-usage' | 'duplicates';

export function Home({ session, onSessionChange, onLogout, theme, onToggleTheme }: HomeProps) {
  // ── Core hooks ──
  const viewPref = useViewPreferences();
  const toast = useToasts();

  const browser = useFileBrowser({
    currentPath: viewPref.currentPath,
    showHidden: viewPref.showHidden,
    session,
  });

  const {
    services,
    health: serviceHealth,
    addService,
    updateService,
    removeService,
    reorderServices,
    refreshHealth: refreshServiceHealth,
  } = useServiceShortcuts();
  const isMobile = useIsMobile();
  const notifPrefs = useNotificationPreferences();

  // SSE connection for job badges (dock + desktop) and health event notifications.
  useJobs(browser.setJobs, {
    session,
    sessionLoading: false,
    onRefresh: browser.refresh,
    showToast: toast.showToast,
    services,
    browserNotifications: notifPrefs.enabled,
  });

  const nav = useNavigation(browser.jobs, browser.trashEntries.length, viewPref.currentPath);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const fileActions = useFileActions();
  const dialogs = useDialogStack();
  const [previewEntries, setPreviewEntries] = useState<FileEntry[]>([]);
  const [mobileAnalysisJobId, setMobileAnalysisJobId] = useState<string | null>(null);
  const [mobileAnalysisPath, setMobileAnalysisPath] = useState<string | null>(null);
  const [mobileAnalysisSection, setMobileAnalysisSection] = useState<AnalysisSection | null>(null);
  const canManage = session.role === 'admin';

  // ── Refs ──
  const filesViewRef = useRef<import('../pages/FilesView').FilesViewHandle>(null);
  const prevHealthRef = useRef<Record<string, ServiceHealthResult>>({});
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  const defaultRootPath = useMemo(() => getDefaultRootPath(browser.roots), [browser.roots]);

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
  const openStorageAnalyzerWindow = workspaceOpeners.openStorageAnalyzer;

  const openStorageAnalyzer = useCallback(
    (path?: string) => {
      setMobileAnalysisJobId(null);
      setMobileAnalysisPath(path ?? null);
      setMobileAnalysisSection(null);
      openStorageAnalyzerWindow(path);
    },
    [openStorageAnalyzerWindow],
  );

  const openAnalysisJob = useCallback(
    (job: Job) => {
      if (job.type !== 'disk_analyze' && job.type !== 'duplicate_find') return;
      if (isMobile) {
        setMobileAnalysisPath(null);
        setMobileAnalysisJobId(job.id);
        setMobileAnalysisSection(job.type === 'duplicate_find' ? 'duplicates' : 'disk-usage');
        nav.setActiveView('storage-analyzer');
        return;
      }
      wm.toggleWindow('storage-analyzer', {
        title: 'Storage Analyzer',
        icon: storageAnalyzerIconUrl(),
        winType: 'storage-analyzer',
        params: {
          jobId: job.id,
          path: job.sourcePath,
          section: job.type === 'duplicate_find' ? 'duplicates' : 'disk-usage',
        },
        width: STANDARD_WINDOW_W,
        height: STANDARD_WINDOW_H,
      });
    },
    [isMobile, nav, wm],
  );

  // Health polling for UI state updates. Notifications are handled by SSE in useJobs.
  useEffect(() => {
    const hasHealthChecks = services.some((service) => service.healthUrl);
    if (!hasHealthChecks) return;

    const shouldRefresh = () =>
      nav.activeView === 'desktop' && document.visibilityState === 'visible';

    async function checkHealth() {
      const next = await refreshServiceHealth();
      if (next) prevHealthRef.current = next;
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
  }, [services, nav.activeView, refreshServiceHealth]);

  // ── Desktop actions ──────────────────────────────────────
  const desktopActions = useDesktopActions({
    browser,
    dialogs,
    toast,
    nav,
    viewPref: { currentPath: viewPref.currentPath, setCurrentPath: viewPref.setCurrentPath },
    selection,
    removeFavorite,
    addService,
    updateService,
    removeService,
    refreshServiceHealth,
    serviceFormData: menus.serviceFormData,
    setDesktopContextMenu: menus.setDesktopContextMenu,
    setServiceFormData: menus.setServiceFormData,
    refresh: navActions.refresh,
    navigateTo: navActions.navigateTo,
    resetToDesktopView: navActions.resetToDesktopView,
  });

  // ── Render window content from type+params ──────────────
  const renderWindow = useCallback(
    (win: WindowState) => {
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
              onOpenStorageAnalyzer={openStorageAnalyzer}
            />
          );
        case 'trash':
          return <TrashView canWrite={canManage} jobs={browser.jobs} />;
        case 'drives':
          return <DrivesView onBackToDesktop={() => wm.closeWindow(win.id)} />;
        case 'jobs':
          return (
            <JobsPage session={session} sessionLoading={false} onOpenAnalysis={openAnalysisJob} />
          );
        case 'storage-analyzer':
          return (
            <StorageAnalyzerView
              key={`${String(win.params.path ?? '')}:${String(win.params.jobId ?? '')}`}
              roots={browser.roots}
              jobs={browser.jobs}
              preselectedPath={
                win.params.jobId ? undefined : (win.params.path as string | undefined)
              }
              preselectedSection={win.params.section as 'disk-usage' | 'duplicates' | undefined}
              initialJobId={win.params.jobId as string | undefined}
              canManage={canManage}
            />
          );
        case 'settings':
          return (
            <SettingsPanel
              onOpenShares={() => dialogs.setSharesOpen(true)}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onOpenShortcuts={() => fileActions.setShortcutsOpen(true)}
              onLogout={onLogout}
              session={session}
              onSessionChange={onSessionChange}
              services={services}
              serviceHealth={serviceHealth}
              onAddService={() => desktopActions.handleOpenServiceForm()}
              onEditService={(id) => {
                const svc = services.find((s) => s.id === id);
                if (svc) desktopActions.handleOpenServiceForm(svc);
              }}
              onRemoveService={desktopActions.handleRemoveService}
              onReorderServices={reorderServices}
            />
          );
        case 'preview': {
          const entry = win.params.entry as FileEntry | undefined;
          const entries = Array.isArray(win.params.entries)
            ? (win.params.entries as FileEntry[])
            : entry
              ? [entry]
              : [];
          if (!entry) return null;
          return (
            <PreviewWindow
              entry={entry}
              entries={entries}
              onShare={
                canManage
                  ? (shareEntry) =>
                      dialogs.setShareDialogPath({ path: shareEntry.path, name: shareEntry.name })
                  : undefined
              }
              onSelectEntry={(nextEntry) => {
                wm.toggleWindow('preview', {
                  title: 'Preview',
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
          const iconUrl = typeof win.params.iconUrl === 'string' ? win.params.iconUrl : undefined;
          if (!url) return null;
          return <ServiceWindow name={name} url={url} iconUrl={iconUrl} />;
        }
        default:
          return null;
      }
    },
    [
      session,
      onSessionChange,
      favorites,
      navActions,
      addFavorite,
      removeFavorite,
      theme,
      onToggleTheme,
      onLogout,
      dialogs,
      fileActions,
      defaultRootPath,
      browser.roots,
      browser.jobs,
      wm,
      workspaceOpeners.openPreview,
      openStorageAnalyzer,
      openAnalysisJob,
      canManage,
      services,
      serviceHealth,
      desktopActions,
      reorderServices,
    ],
  );

  const { previewPositionLabel, previousPreviewEntry, nextPreviewEntry } = usePreviewNavigation(
    fileActions.previewEntry,
    previewEntries,
  );

  // ── Effects ──────────────────────────────────────────────

  useKeyboardShortcuts({
    '?': () => fileActions.setShortcutsOpen((p) => !p),
    Escape: () => {
      if (fileActions.shortcutsOpen) fileActions.setShortcutsOpen(false);
    },
  });

  const closeAllHomeMenus = useCallback(() => {
    menus.setTrashContextMenu(null);
    menus.setDesktopContextMenu(null);
  }, [menus]);

  useClickOutsideMenus(closeAllHomeMenus);

  // ── Desktop handlers ─────────────────────────────────────
  const handleDesktopItemContextMenu = useCallback(
    (item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      menus.setDesktopContextMenu({ x: event.clientX, y: event.clientY, item });
    },
    [menus],
  );

  // ── Derived data ─────────────────────────────────────────

  const showStatusBar = !isMobile ? false : nav.activeView === 'trash';

  // ── Taskbar launcher handler ─────────────────────────────
  const handleTaskbarLauncher = useCallback(
    (id: string) => {
      if (id === 'files') workspaceOpeners.openFiles();
      else if (id === 'trash') workspaceOpeners.openTrash();
      else if (id === 'jobs') workspaceOpeners.openJobs();
      else if (id === 'settings') workspaceOpeners.openSettings();
      else if (id === 'drives') workspaceOpeners.openDrives();
      else if (id === 'storage-analyzer') openStorageAnalyzer();
      else if (id === 'desktop') workspaceOpeners.openDesktop();
      else desktopActions.handleDockActivate(id);
    },
    [workspaceOpeners, desktopActions, openStorageAnalyzer],
  );

  // ── Focused window & reactive commands ──────────────────
  const [commandsMap, setCommandsMap] = useState<Record<string, WindowCommands>>({});
  const registerCommands = useCallback((id: string, cmds: WindowCommands) => {
    setCommandsMap((prev) => {
      const existing = prev[id];
      if (
        existing &&
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
        existing.selectedCount === cmds.selectedCount
      ) {
        return prev;
      }
      return { ...prev, [id]: cmds };
    });
  }, []);
  const unregisterCommands = useCallback((id: string) => {
    setCommandsMap((prev) => {
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

  const previousMobileRef = useRef(isMobile);
  const analyzerTransferredToMobileRef = useRef<ActiveView | null>(null);
  useEffect(() => {
    if (isMobile && !previousMobileRef.current && focusedWindow?.winType === 'storage-analyzer') {
      const jobId =
        typeof focusedWindow.params.jobId === 'string' ? focusedWindow.params.jobId : null;
      const path = typeof focusedWindow.params.path === 'string' ? focusedWindow.params.path : null;
      const section =
        focusedWindow.params.section === 'duplicates' ||
        focusedWindow.params.section === 'disk-usage'
          ? focusedWindow.params.section
          : null;
      const inferredJob =
        !jobId && path
          ? browser.jobs
              .filter(
                (job) =>
                  job.sourcePath === path &&
                  job.type === (section === 'duplicates' ? 'duplicate_find' : 'disk_analyze'),
              )
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
          : undefined;
      const transferredJobId = jobId ?? inferredJob?.id ?? null;
      analyzerTransferredToMobileRef.current = nav.activeView;
      setMobileAnalysisJobId(transferredJobId);
      setMobileAnalysisPath(transferredJobId ? null : path);
      setMobileAnalysisSection(
        section ??
          (inferredJob?.type === 'duplicate_find'
            ? 'duplicates'
            : inferredJob
              ? 'disk-usage'
              : null),
      );
      nav.setActiveView('storage-analyzer');
    } else if (!isMobile && previousMobileRef.current && analyzerTransferredToMobileRef.current) {
      nav.setActiveView(analyzerTransferredToMobileRef.current);
      analyzerTransferredToMobileRef.current = null;
    } else if (
      !isMobile &&
      previousMobileRef.current &&
      focusedWindow?.winType === 'drives' &&
      nav.activeView === 'drives'
    ) {
      navActions.resetToDesktopView();
    }
    previousMobileRef.current = isMobile;
  }, [browser.jobs, focusedWindow, isMobile, nav, navActions]);

  const focusedCommands = focusedWindow
    ? (commandsMap[focusedWindow.id] ?? {})
    : ({} as WindowCommands);
  const topBarTitle = !isMobile
    ? (focusedWindow?.title ?? nav.topBarTitle ?? 'Desktop')
    : nav.topBarTitle;

  // ── Shell context value ────────────────────────────────
  const shellContext = useMemo(
    () => ({
      showToastObj: toast.showToastObj,
      navigateTo: navActions.navigateTo,
    }),
    [toast.showToastObj, navActions.navigateTo],
  );

  const showLogoutToast = toast.showToastObj;
  const handleTopBarLogout = useCallback(() => {
    void onLogout().catch((error) => {
      showLogoutToast({
        title: 'Could not log out',
        message: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      });
    });
  }, [onLogout, showLogoutToast]);

  // ── Shell JSX ────────────────────────────────────────────

  const shell = (
    <>
      <main className={`${styles.appShell}${showStatusBar ? ` ${styles.withShellStatus}` : ''}`}>
        <CommandsContext.Provider
          value={{
            commands: commandsMap,
            register: registerCommands,
            unregister: unregisterCommands,
          }}
        >
          <ShellContext.Provider value={shellContext}>
            <TopBar
              activeView={nav.activeView}
              title={topBarTitle}
              onGoDesktop={navActions.resetToDesktopView}
              onOpenSettings={workspaceOpeners.openSettings}
              session={session}
              onLogout={handleTopBarLogout}
              focusedWindowType={focusedWindow?.winType ?? null}
              focusedWindowExists={!isMobile && focusedWindow !== null}
              searchQuery={browser.query}
              searchOpen={browser.searchOpen}
              searchResults={browser.searchResults}
              searchLoading={browser.searchLoading}
              searchError={browser.searchError}
              onSearch={(q) => {
                browser.setQuery(q);
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => browser.handleGlobalSearch(q), 200);
                browser.setSearchOpen(true);
              }}
              onClearSearch={() => {
                browser.resetGlobalSearch();
              }}
              onSearchResultClick={(result) => {
                if (result.type === 'directory') navActions.navigateTo(result.path);
                else {
                  const idx = result.path.lastIndexOf('/');
                  navActions.navigateTo(idx < 0 ? '/' : result.path.substring(0, idx) || '/');
                }
              }}
              onShowAllSearchResults={(query) => {
                nav.setSearchQuery(query);
                nav.setActiveView('search');
                browser.setSearchOpen(false);
              }}
              theme={theme}
              onToggleTheme={onToggleTheme}
              jobs={browser.jobs}
              onOpenJobs={workspaceOpeners.openJobs}
              onOpenAnalysis={openAnalysisJob}
              menuHandlers={{
                onCreateFolder:
                  focusedCommands.onCreateFolder ??
                  (() => filesViewRef.current?.handleCreateFolder()),
                onUpload: focusedCommands.onUpload ?? (() => filesViewRef.current?.handleUpload()),
                onCut: focusedCommands.onCut ?? (() => filesViewRef.current?.handleCut()),
                onCopy: focusedCommands.onCopy ?? (() => filesViewRef.current?.handleCopy()),
                onPaste: focusedCommands.onPaste ?? (() => filesViewRef.current?.handlePaste()),
                onSelectAll:
                  focusedCommands.onSelectAll ?? (() => filesViewRef.current?.handleSelectAll()),
                onInvertSelection:
                  focusedCommands.onInvertSelection ??
                  (() => filesViewRef.current?.handleInvertSelection()),
                onRename: focusedCommands.onRename ?? (() => filesViewRef.current?.handleRename()),
                onDelete: focusedCommands.onDelete ?? (() => filesViewRef.current?.handleDelete()),
                onRestore: focusedCommands.onRestore,
                onDeleteForever: focusedCommands.onDeleteForever,
                onEmptyTrash: focusedCommands.onEmptyTrash,
                onClose: focusedWindow
                  ? () => wm.closeWindow(focusedWindow.id)
                  : navActions.resetToDesktopView,
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
                selectedCount:
                  focusedCommands.selectedCount ??
                  (nav.activeView === 'trash'
                    ? selection.selectedTrashIds.length
                    : selection.selectedPaths.length),
              }}
            />
            <Dock
              items={nav.dockItems}
              onActivate={handleTaskbarLauncher}
              shellStatusVisible={showStatusBar}
            />

            <section
              className={`${styles.workspace}${isMobile && nav.activeView !== 'desktop' ? ` ${styles.mobileAppWorkspace}` : ''}`}
              onClick={selection.handleWorkspaceClick}
            >
              {nav.activeView === 'desktop' && (
                <DesktopView
                  trashEntries={browser.trashEntries}
                  jobs={browser.jobs}
                  favorites={favorites}
                  services={services}
                  serviceHealth={serviceHealth}
                  onNavigateTo={workspaceOpeners.openFiles}
                  onNavigateToTrash={workspaceOpeners.openTrash}
                  onOpenSettings={workspaceOpeners.openSettings}
                  onOpenJobs={workspaceOpeners.openJobs}
                  onOpenFiles={() => workspaceOpeners.openFiles()}
                  onOpenStorageAnalyzer={openStorageAnalyzer}
                  onOpenService={workspaceOpeners.openService}
                  onShowMyPC={workspaceOpeners.openDrives}
                  onItemContextMenu={handleDesktopItemContextMenu}
                />
              )}
              {nav.activeView === 'drives' && <DrivesView />}
              {nav.activeView === 'trash' && <TrashView canWrite={canManage} jobs={browser.jobs} />}
              {nav.activeView === 'search' && (
                <SearchResultsView
                  initialQuery={nav.searchQuery}
                  session={session}
                  onNavigate={navActions.navigateTo}
                  onClose={() => {
                    navActions.resetToDesktopView();
                  }}
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
                  onOpenStorageAnalyzer={openStorageAnalyzer}
                  onShowAllSearchResults={(query) => {
                    nav.setSearchQuery(query);
                    nav.setActiveView('search');
                  }}
                />
              )}
              {nav.activeView === 'jobs' && (
                <JobsPage
                  session={session}
                  sessionLoading={false}
                  onOpenAnalysis={openAnalysisJob}
                />
              )}
              {nav.activeView === 'storage-analyzer' && (
                <StorageAnalyzerView
                  roots={browser.roots}
                  jobs={browser.jobs}
                  preselectedPath={
                    mobileAnalysisJobId ? undefined : (mobileAnalysisPath ?? undefined)
                  }
                  preselectedSection={mobileAnalysisSection ?? undefined}
                  initialJobId={mobileAnalysisJobId ?? undefined}
                  canManage={canManage}
                />
              )}
              {nav.activeView === 'settings' && (
                <SettingsPanel
                  onOpenShares={() => {
                    nav.setActiveView(viewPref.currentPath ? 'files' : 'desktop');
                    dialogs.setSharesOpen(true);
                  }}
                  theme={theme}
                  onToggleTheme={onToggleTheme}
                  onOpenShortcuts={() => fileActions.setShortcutsOpen(true)}
                  onLogout={onLogout}
                  session={session}
                  onSessionChange={onSessionChange}
                  services={services}
                  serviceHealth={serviceHealth}
                  onAddService={() => desktopActions.handleOpenServiceForm()}
                  onEditService={(id) => {
                    const svc = services.find((s) => s.id === id);
                    if (svc) desktopActions.handleOpenServiceForm(svc);
                  }}
                  onRemoveService={desktopActions.handleRemoveService}
                  onReorderServices={reorderServices}
                />
              )}

              {menus.desktopContextMenu && (
                <DesktopContextMenu
                  x={menus.desktopContextMenu.x}
                  y={menus.desktopContextMenu.y}
                  item={menus.desktopContextMenu.item}
                  trashCount={browser.trashEntries.length}
                  canManage={canManage}
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
              totalItems={
                nav.activeView === 'trash' ? browser.trashEntries.length : browser.entries.length
              }
              selectedCount={
                nav.activeView === 'trash'
                  ? selection.selectedTrashIds.length
                  : selection.selectedPaths.length
              }
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

  return (
    <>
      {shell}
      {dialogs.shareDialogPath && (
        <ShareDialog
          path={dialogs.shareDialogPath.path}
          name={dialogs.shareDialogPath.name}
          onClose={() => dialogs.setShareDialogPath(null)}
        />
      )}
      {fileActions.previewEntry && (
        <PreviewModal
          entry={fileActions.previewEntry}
          onClose={() => fileActions.setPreviewEntry(null)}
          onDownload={() => openFileExternally(fileActions.previewEntry!.path)}
          onShare={
            canManage
              ? () =>
                  dialogs.setShareDialogPath({
                    path: fileActions.previewEntry!.path,
                    name: fileActions.previewEntry!.name,
                  })
              : undefined
          }
          onPrevious={
            previousPreviewEntry
              ? () => fileActions.setPreviewEntry(previousPreviewEntry)
              : undefined
          }
          onNext={
            nextPreviewEntry ? () => fileActions.setPreviewEntry(nextPreviewEntry) : undefined
          }
          previousDisabled={!previousPreviewEntry}
          nextDisabled={!nextPreviewEntry}
          positionLabel={previewPositionLabel}
        />
      )}
      {fileActions.shortcutsOpen && (
        <KeyboardShortcuts onClose={() => fileActions.setShortcutsOpen(false)} />
      )}
      {dialogs.sharesOpen && <ShareManager onClose={() => dialogs.setSharesOpen(false)} />}
      {menus.serviceFormData && (
        <ServiceFormModal
          initial={menus.serviceFormData.initial}
          onSave={desktopActions.handleSaveService}
          onClose={() => menus.setServiceFormData(null)}
        />
      )}
      {dialogs.confirmDialog && (
        <ConfirmDialog
          dialog={dialogs.confirmDialog}
          onClose={() => dialogs.setConfirmDialog(null)}
        />
      )}
    </>
  );
}
