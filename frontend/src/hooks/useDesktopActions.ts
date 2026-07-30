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
            const results = await Promise.allSettled(
              browser.trashEntries.map((entry) => deleteTrash(entry.id)),
            );
            const failedCount = results.filter((result) => result.status === 'rejected').length;
            const deletedCount = results.length - failedCount;
            const r = await getTrash();
            browser.setTrashEntries(r.entries ?? []);
            if (failedCount === 0) {
              browser.setError(null);
              toast.showToastObj({ title: 'Trash emptied', variant: 'success' });
            } else {
              const message = `${failedCount} item${failedCount === 1 ? '' : 's'} could not be deleted.`;
              browser.setError(message);
              toast.showToastObj({
                title: deletedCount > 0 ? 'Trash partially emptied' : 'Could not empty Trash',
                message,
                variant: 'error',
              });
            }
            if (deletedCount > 0) refresh();
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
      if (data.healthUrl) {
        try {
          await refreshServiceHealth();
        } catch (err) {
          toast.showToastObj({
            title: 'Service saved; health check unavailable',
            message: err instanceof Error ? err.message : undefined,
            variant: 'warning',
          });
        }
      }
    },
    [serviceFormData, addService, updateService, refreshServiceHealth, toast],
  );

  const handleRemoveService = useCallback(
    (id: string) => {
      dialogs.setConfirmDialog({
        title: 'Remove service shortcut?',
        message: 'This removes the shortcut from the desktop. The service itself is not changed.',
        confirmLabel: 'Remove shortcut',
        danger: true,
        onConfirm: () => {
          void removeService(id)
            .then(() =>
              toast.showToastObj({
                title: 'Service removed from desktop',
                variant: 'success',
              }),
            )
            .catch((err) =>
              toast.showToastObj({
                title: 'Could not remove service',
                message: err instanceof Error ? err.message : undefined,
                variant: 'error',
              }),
            );
        },
      });
    },
    [dialogs, removeService, toast],
  );

  const handleDesktopNavigateToTrash = useCallback(() => {
    viewPref.setCurrentPath('');
    nav.setActiveView('trash');
    selection.setSelectedPaths([]);
  }, [viewPref, nav, selection]);

  const handleDockActivate = useCallback(
    (id: string) => {
      switch (id) {
        case 'desktop':
          resetToDesktopView();
          break;
        case 'files':
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
          break;
        case 'settings':
          nav.setActiveView('settings');
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
    handleDesktopNavigateToTrash,
    handleDockActivate,
    handleRefreshDesktop,
  };
}
