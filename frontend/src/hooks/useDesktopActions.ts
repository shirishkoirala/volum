import { useCallback } from 'react';
import { getTrash, deleteTrash } from '../api/client';
import type { ServiceShortcut } from '../utils/services';
import type { DesktopIconItem } from '../pages/DesktopView';

interface DesktopActionsOptions {
  browser: {
    trashEntries: import('../api/client').TrashEntry[];
    setTrashEntries: React.Dispatch<React.SetStateAction<import('../api/client').TrashEntry[]>>;
    setError: (err: string | null) => void;
    loadDevices: () => void;
    roots: import('../api/client').RootEntry[];
  };
  dialogs: {
    setConfirmDialog: React.Dispatch<React.SetStateAction<import('../components/overlay/Dialogs').ConfirmDialogState>>;
  };
  toast: {
    showToastObj: (toast: Omit<import('../components/overlay/Toast').Toast, 'id'>, timeout?: number) => void;
  };
  nav: {
    setShowingTrash: (v: boolean) => void;
    setShowingSettings: (v: boolean) => void;
    setShowingJobs: (v: boolean) => void;
    setShowingMyPC: (v: boolean) => void;
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
  updateService: (id: string, data: { name: string; url: string; iconUrl?: string; healthUrl?: string; description?: string; openMode?: 'embed' | 'tab' }) => Promise<unknown>;
  removeService: (id: string) => Promise<void>;
  refreshServiceHealth: () => Promise<unknown>;
  serviceFormData: { initial?: ServiceShortcut } | null;
  setDesktopContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; item: DesktopIconItem } | null>>;
  setServiceFormData: React.Dispatch<React.SetStateAction<{ initial?: ServiceShortcut } | null>>;
  refresh: () => void;
  navigateTo: (path: string) => void;
  resetToDesktopView: () => void;
}

export function useDesktopActions(opts: DesktopActionsOptions) {
  const {
    browser, dialogs, toast, nav, viewPref, selection,
    removeFavorite, addService, updateService, removeService,
    refreshServiceHealth,
    serviceFormData, setDesktopContextMenu, setServiceFormData,
    refresh, navigateTo, resetToDesktopView,
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
      }
    });
  }, [browser, dialogs, toast, refresh, setDesktopContextMenu]);

  const handleRemoveDesktopFavorite = useCallback((path: string) => {
    removeFavorite(path);
    toast.showToastObj({ title: 'Removed from desktop', variant: 'success' });
  }, [removeFavorite, toast]);

  const handleOpenServiceForm = useCallback((svc?: ServiceShortcut) => {
    setDesktopContextMenu(null);
    setServiceFormData(svc ? { initial: svc } : {});
  }, [setDesktopContextMenu, setServiceFormData]);

  const handleSaveService = useCallback(async (data: { name: string; url: string; iconUrl?: string; healthUrl?: string; description?: string; openMode: 'embed' | 'tab' }) => {
    if (serviceFormData?.initial) {
      await updateService(serviceFormData.initial.id, data);
      toast.showToastObj({ title: 'Service updated', variant: 'success' });
    } else {
      await addService({ id: '', name: data.name, url: data.url, iconUrl: data.iconUrl, healthUrl: data.healthUrl, description: data.description, openMode: data.openMode });
      toast.showToastObj({ title: 'Service added', variant: 'success' });
    }
    if (data.healthUrl) await refreshServiceHealth();
  }, [serviceFormData, addService, updateService, refreshServiceHealth, toast]);

  const handleRemoveService = useCallback((id: string) => {
    removeService(id);
    toast.showToastObj({ title: 'Service removed from desktop', variant: 'success' });
  }, [removeService, toast]);

  const handleBackToDesktop = useCallback(() => {
    nav.setShowingMyPC(false);
    nav.setSelectedDriveName(null);
  }, [nav]);

  const handleDesktopNavigateToTrash = useCallback(() => {
    viewPref.setCurrentPath('');
    nav.setShowingTrash(true);
    nav.setShowingSettings(false);
    nav.setShowingJobs(false);
    nav.setShowingMyPC(false);
    selection.setSelectedPaths([]);
    nav.setSelectedDriveName(null);
  }, [viewPref, nav, selection]);

  const handleDockActivate = useCallback((id: string) => {
    switch (id) {
      case 'desktop': resetToDesktopView(); break;
      case 'files':
        nav.setShowingTrash(false); nav.setShowingSettings(false); nav.setShowingJobs(false);
        nav.setShowingMyPC(false); nav.setSelectedDriveName(null);
        if (viewPref.currentPath === '') {
          const target = browser.roots.find((r) => r.available)?.path;
          if (target) navigateTo(target);
        }
        break;
      case 'trash':
        viewPref.setCurrentPath('');
        nav.setShowingTrash(true); nav.setShowingSettings(false); nav.setShowingJobs(false);
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
