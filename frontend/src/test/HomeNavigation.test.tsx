import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../screens/Home';

const state = vi.hoisted(() => ({
  isMobile: false,
  noop: vi.fn(),
  browser: {
    devices: [],
    jobs: [],
    trashEntries: [],
    entries: [],
    filteredEntries: [],
    roots: [],
    query: '',
    searchOpen: false,
    searchResults: null,
    canWrite: true,
    selectedFileBytes: 0,
    currentRoot: null,
    setJobs: vi.fn(),
    refresh: vi.fn(),
    loadDevices: vi.fn(),
    setTrashEntries: vi.fn(),
    setError: vi.fn(),
    setQuery: vi.fn(),
    handleGlobalSearch: vi.fn(),
    setSearchOpen: vi.fn(),
    setSearchResults: vi.fn(),
  },
  viewPref: {
    currentPath: '',
    setCurrentPath: vi.fn(),
    navigateToPath: vi.fn(),
    viewMode: 'grid',
    setViewMode: vi.fn(),
    sortField: 'name',
    setSortField: vi.fn(),
    sortDirection: 'asc',
    setSortDirection: vi.fn(),
    showHidden: false,
    setShowHidden: vi.fn(),
  },
  fileActions: {
    previewEntry: null,
    setPreviewEntry: vi.fn(),
    shortcutsOpen: false,
    setShortcutsOpen: vi.fn(),
  },
  dialogs: {
    shareDialogPath: null,
    setShareDialogPath: vi.fn(),
    sharesOpen: false,
    setSharesOpen: vi.fn(),
  },
  menus: {
    serviceFormData: null,
    desktopContextMenu: null,
    setDesktopContextMenu: vi.fn(),
    setServiceFormData: vi.fn(),
    setTrashContextMenu: vi.fn(),
    setTrashEmptyMenu: vi.fn(),
    setJobsEmptyMenu: vi.fn(),
  },
  selection: {
    selectedPaths: [],
    selectedTrashIds: [],
    setSelectedPaths: vi.fn(),
    handleWorkspaceClick: vi.fn(),
  },
  windowManager: {
    windows: [
      {
        id: 'storage-analyzer',
        title: 'Storage Analyzer',
        icon: '',
        winType: 'storage-analyzer',
        params: {},
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        minimized: false,
        maximized: false,
        zIndex: 1,
      },
    ],
    openWindow: vi.fn(),
    closeWindow: vi.fn(),
    focusWindow: vi.fn(),
    toggleMinimize: vi.fn(),
    toggleMaximize: vi.fn(),
    updatePosition: vi.fn(),
    updateSize: vi.fn(),
    toggleWindow: vi.fn(),
  },
}));

vi.mock('../hooks/useFileBrowser', () => ({
  useFileBrowser: () => state.browser,
}));
vi.mock('../hooks/useViewPreferences', () => ({
  useViewPreferences: () => state.viewPref,
}));
vi.mock('../hooks/useServiceShortcuts', () => ({
  useServiceShortcuts: () => ({
    services: [],
    health: {},
    addService: state.noop,
    updateService: state.noop,
    removeService: state.noop,
    reorderServices: state.noop,
    refreshHealth: state.noop,
  }),
}));
vi.mock('../hooks/useJobs', () => ({ useJobs: state.noop }));
vi.mock('../hooks/useFavorites', () => ({
  useFavorites: () => ({ favorites: [], addFavorite: state.noop, removeFavorite: state.noop }),
}));
vi.mock('../hooks/useFileActions', () => ({
  useFileActions: () => state.fileActions,
}));
vi.mock('../hooks/useDialogStack', () => ({
  useDialogStack: () => state.dialogs,
}));
vi.mock('../hooks/useToasts', () => ({
  useToasts: () => ({
    toasts: [],
    showToast: state.noop,
    showToastObj: state.noop,
    dismissToast: state.noop,
  }),
}));
vi.mock('../hooks/useSelection', () => ({
  useSelection: () => state.selection,
}));
vi.mock('../hooks/useContextMenus', () => ({
  useContextMenus: () => state.menus,
}));
vi.mock('../hooks/useNavStack', () => ({
  useNavStack: () => ({
    refresh: state.noop,
    navigateTo: state.noop,
    goBack: state.noop,
    resetToDesktopView: state.noop,
  }),
}));
vi.mock('../hooks/useDesktopActions', () => ({
  useDesktopActions: () => ({
    handleDockActivate: state.noop,
    handleOpenServiceForm: state.noop,
    handleRemoveService: state.noop,
    handleRefreshDesktop: state.noop,
    handleEmptyTrash: state.noop,
    handleRemoveDesktopFavorite: state.noop,
    handleSaveService: state.noop,
  }),
}));
vi.mock('../hooks/useWorkspaceOpeners', () => ({
  useWorkspaceOpeners: () => ({
    openDesktop: state.noop,
    openDrives: state.noop,
    openFiles: state.noop,
    openJobs: state.noop,
    openPreview: state.noop,
    openService: state.noop,
    openSettings: state.noop,
    openStorageAnalyzer: state.noop,
    openTrash: state.noop,
  }),
}));
vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => state.isMobile,
}));
vi.mock('../hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({ enabled: false }),
}));
vi.mock('../hooks/useClickOutsideMenus', () => ({ useClickOutsideMenus: state.noop }));
vi.mock('../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: state.noop }));
vi.mock('../hooks/usePreviewNavigation', () => ({
  usePreviewNavigation: () => ({
    previewPositionLabel: undefined,
    previousPreviewEntry: undefined,
    nextPreviewEntry: undefined,
  }),
}));
vi.mock('../contexts/WindowManager', () => ({
  useWindowManager: () => state.windowManager,
}));

vi.mock('../components/layout/TopBar', () => ({
  TopBar: ({ onShowAllSearchResults }: { onShowAllSearchResults: (query: string) => void }) => (
    <button type="button" onClick={() => onShowAllSearchResults('documents')}>
      Open search
    </button>
  ),
}));
vi.mock('../pages/SearchResultsView', () => ({
  SearchResultsView: () => <div>Search results</div>,
}));
vi.mock('../pages/StorageAnalyzerView', () => ({
  StorageAnalyzerView: () => <div>Storage analyzer</div>,
}));

vi.mock('../components/overlay/HomeOverlays', () => ({ HomeOverlays: () => null }));
vi.mock('../pages/SettingsPanel', () => ({ SettingsPanel: () => null }));
vi.mock('../components/layout/Dock', () => ({ Dock: () => null }));
vi.mock('../components/layout/StatusBar', () => ({ StatusBar: () => null }));
vi.mock('../pages/FilesView', () => ({ FilesView: () => null }));
vi.mock('../pages/DesktopView', () => ({ DesktopView: () => null }));
vi.mock('../pages/DrivesView', () => ({ DrivesView: () => null }));
vi.mock('../pages/TrashView', () => ({ TrashView: () => null }));
vi.mock('../pages/JobsPage', () => ({ JobsPage: () => null }));
vi.mock('../components/overlay/Toast', () => ({ ToastViewport: () => null }));
vi.mock('../components/window/WindowHost', () => ({ WindowHost: () => null }));
vi.mock('../components/overlay/DesktopContextMenu', () => ({ DesktopContextMenu: () => null }));
vi.mock('../components/layout/Taskbar', () => ({ Taskbar: () => null }));

const homeProps = {
  session: { authEnabled: true, authenticated: true, role: 'admin' as const },
  onSessionChange: vi.fn(),
  onLogout: vi.fn(),
  theme: 'light' as const,
  onToggleTheme: vi.fn(),
};

describe('Home responsive navigation', () => {
  beforeEach(() => {
    state.isMobile = false;
  });

  it('restores the active view after transferring the focused analyzer through mobile', () => {
    const view = render(<Home {...homeProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    expect(screen.getByText('Search results')).toBeInTheDocument();

    state.isMobile = true;
    view.rerender(<Home {...homeProps} />);
    expect(screen.getByText('Storage analyzer')).toBeInTheDocument();

    state.isMobile = false;
    view.rerender(<Home {...homeProps} />);
    expect(screen.getByText('Search results')).toBeInTheDocument();
  });
});
