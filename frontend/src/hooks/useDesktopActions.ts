import { useCallback } from 'react';
import { getTrash, deleteTrash } from '../api/client-files';
import type { RootEntry, TrashEntry } from '../api/client-files';
import type { ServiceShortcut } from '../utils/services';
import type { DesktopIconItem } from './useDesktopIcons';
import { defaultRootPath } from '../utils/roots';
import type { ActiveView } from './useNavigation';

interface DesktopActionsOptions {
  browser: {
    trashEntries: TrashEntry[];
    setTrashEntries: React.Dispatch<React.SetStateAction<TrashEntry[]>>;
    setError: (err: string | null) => void;
    loadDevices: () => void;
    roots: RootEntry[];
  };
  dialogs: {
    setConfirmDialog: React.Dispatch<
      React.SetStateAction<import('../components/overlay/ConfirmDialog').ConfirmDialogState>
    >;
  };
  toast: {
    showToastObj: (
      toast: Omit<import('../components/overlay/Toast').Toast, 'id'>,
      timeout?: number,
    ) => void;
  };
  nav: {
    setActiveView: (view: ActiveView) => void;
    setSelectedDriveName: (v: string | null) => void;
  };
  viewPref: {
    currentPath: string;
    setCurrentPath: (path: string) => void;
  };
  selection: {
    setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  };
  removeFavorite: (path: string) => void;
  addService: (svc: ServiceShortcut) => Promise<unknown>;
  updateService: (
    id: string,
    data: {
      name: string;
      url: string;
      iconUrl?: string;
      healthUrl?: string;
      description?: string;
      openMode?: 'embed' | 'tab';
    },
  ) => Promise<unknown>;
  removeService: (id: string) => Promise<void>;
  refreshServiceHealth: () => Promise<unknown>;
  serviceFormData: { initial?: ServiceShortcut } | null;
  setDesktopContextMenu: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; item: DesktopIconItem } | null>
  >;
  setServiceFormData: React.Dispatch<React.SetStateAction<{ initial?: ServiceShortcut } | null>>;
  refresh: () => void;
  navigateTo: (path: string) => void;
  resetToDesktopView: () => void;
}

export function useDesktopActions(opts: DesktopActionsOptions) {
  const {
    browser,
    dialogs,
    toast,
    nav,
    viewPref,
    selection,
    removeFavorite,
    addService,
    updateService,
    removeService,
    refreshServiceHealth,
    serviceFormData,
    setDesktopContextMenu,
    setServiceFormData,
    refresh,
    navigateTo,
    resetToDesktopView,
  } = opts;

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
      },
    });
  }, [browser, dialogs, toast, refresh, setDesktopContextMenu]);

  const handleRemoveDesktopFavorite = useCallback(
    (path: string) => {
      removeFavorite(path);
      toast.showToastObj({ title: 'Removed from desktop', variant: 'success' });
    },
    [removeFavorite, toast],
  );

  const handleOpenServiceForm = useCallback(
    (svc?: ServiceShortcut) => {
      setDesktopContextMenu(null);
      setServiceFormData(svc ? { initial: svc } : {});
    },
    [setDesktopContextMenu, setServiceFormData],
  );

  const handleSaveService = useCallback(
    async (data: {
      name: string;
      url: string;
      iconUrl?: string;
      healthUrl?: string;
      description?: string;
      openMode: 'embed' | 'tab';
    }) => {
      if (serviceFormData?.initial) {
        await updateService(serviceFormData.initial.id, data);
        toast.showToastObj({ title: 'Service updated', variant: 'success' });
      } else {
        await addService({
          id: '',
          name: data.name,
          url: data.url,
          iconUrl: data.iconUrl,
          healthUrl: data.healthUrl,
          description: data.description,
          openMode: data.openMode,
        });
        toast.showToastObj({ title: 'Service added', variant: 'success' });
      }
      if (data.healthUrl) await refreshServiceHealth();
    },
    [serviceFormData, addService, updateService, refreshServiceHealth, toast],
  );

  const handleRemoveService = useCallback(
    (id: string) => {
      removeService(id);
      toast.showToastObj({ title: 'Service removed from desktop', variant: 'success' });
    },
    [removeService, toast],
  );

  const handleBackToDesktop = useCallback(() => {
    nav.setActiveView('desktop');
    nav.setSelectedDriveName(null);
  }, [nav]);

  const handleDesktopNavigateToTrash = useCallback(() => {
    viewPref.setCurrentPath('');
    nav.setActiveView('trash');
    selection.setSelectedPaths([]);
    nav.setSelectedDriveName(null);
  }, [viewPref, nav, selection]);

  const handleDockActivate = useCallback(
    (id: string) => {
      switch (id) {
        case 'desktop':
          resetToDesktopView();
          break;
        case 'files':
          nav.setSelectedDriveName(null);
          if (viewPref.currentPath === '') {
            navigateTo(defaultRootPath(browser.roots));
          } else {
            nav.setActiveView('files');
          }
          break;
        case 'trash':
          viewPref.setCurrentPath('');
          nav.setActiveView('trash');
          break;
        case 'jobs':
          nav.setActiveView('jobs');
          nav.setSelectedDriveName(null);
          break;
        case 'settings':
          nav.setActiveView('settings');
          nav.setSelectedDriveName(null);
          break;
      }
    },
    [viewPref, nav, browser.roots, navigateTo, resetToDesktopView],
  );

  const handleRefreshDesktop = useCallback(() => {
    browser.loadDevices();
    refresh();
    toast.showToastObj({ title: 'Refreshed', variant: 'success' });
  }, [browser, refresh, toast]);

  return {
    handleEmptyTrash,
    handleRemoveDesktopFavorite,
    handleOpenServiceForm,
    handleSaveService,
    handleRemoveService,
    handleBackToDesktop,
    handleDesktopNavigateToTrash,
    handleDockActivate,
    handleRefreshDesktop,
  };
}
