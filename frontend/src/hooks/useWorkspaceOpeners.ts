import { useCallback } from 'react';
import type { FileEntry } from '../api/client';
import {
  fileTypeIconUrl,
  filesIconUrl,
  jobsIconUrl,
  multidiskIconUrl,
  preferencesIconUrl,
  trashIconUrl,
} from '../api/icons';
import type { WindowManagerType } from '../contexts/WindowManager';
import type { ServiceShortcut } from '../utils/services';
import { STANDARD_WINDOW_W, STANDARD_WINDOW_H, getStandardWindowPos } from '../utils/window';

type WorkspaceNav = {
  setShowingTrash: (value: boolean) => void;
  setShowingSettings: (value: boolean) => void;
  setShowingJobs: (value: boolean) => void;
  setShowingMyPC: (value: boolean) => void;
  setSelectedDriveName: (value: string | null) => void;
};

type WorkspaceNavActions = {
  navigateTo: (path: string) => void;
  resetToDesktopView: () => void;
};

type UseWorkspaceOpenersParams = {
  defaultRootPath: string;
  isMobile: boolean;
  nav: WorkspaceNav;
  navActions: WorkspaceNavActions;
  setPreviewEntry: (entry: FileEntry | null) => void;
  setPreviewEntries: (entries: FileEntry[]) => void;
  trashCount: number;
  wm: WindowManagerType;
};

export function useWorkspaceOpeners({
  defaultRootPath,
  isMobile,
  nav,
  navActions,
  setPreviewEntry,
  setPreviewEntries,
  trashCount,
  wm,
}: UseWorkspaceOpenersParams) {
  const openFiles = useCallback(
    (path?: string) => {
      if (isMobile) {
        navActions.navigateTo(path ?? defaultRootPath);
        return;
      }

      const { x: fx, y: fy } = getStandardWindowPos();
      wm.toggleWindow('files', {
        title: 'Files',
        icon: filesIconUrl(),
        winType: 'files',
        params: { path: path ?? defaultRootPath },
        width: STANDARD_WINDOW_W,
        height: STANDARD_WINDOW_H,
        x: fx,
        y: fy,
      });
    },
    [defaultRootPath, isMobile, navActions, wm],
  );

  const openDrives = useCallback(() => {
    if (isMobile) {
      nav.setShowingMyPC(true);
      nav.setShowingTrash(false);
      nav.setShowingSettings(false);
      nav.setShowingJobs(false);
      return;
    }

    const { x: dx, y: dy } = getStandardWindowPos();
    wm.toggleWindow('drives', {
      title: 'Drives',
      icon: multidiskIconUrl(),
      winType: 'drives',
      params: {},
      width: STANDARD_WINDOW_W,
      height: STANDARD_WINDOW_H,
      x: dx,
      y: dy,
    });
  }, [isMobile, nav, wm]);

  const openTrash = useCallback(() => {
    if (isMobile) {
      nav.setShowingTrash(true);
      nav.setShowingSettings(false);
      nav.setShowingJobs(false);
      nav.setShowingMyPC(false);
      nav.setSelectedDriveName(null);
      return;
    }

    const { x: tx, y: ty } = getStandardWindowPos();
    wm.toggleWindow('trash', {
      title: 'Trash',
      icon: trashIconUrl(trashCount > 0),
      winType: 'trash',
      params: {},
      width: STANDARD_WINDOW_W,
      height: STANDARD_WINDOW_H,
      x: tx,
      y: ty,
    });
  }, [isMobile, nav, trashCount, wm]);

  const openJobs = useCallback(() => {
    if (isMobile) {
      nav.setShowingJobs(true);
      nav.setShowingTrash(false);
      nav.setShowingSettings(false);
      nav.setShowingMyPC(false);
      nav.setSelectedDriveName(null);
      return;
    }

    const { x: jx, y: jy } = getStandardWindowPos();
    wm.toggleWindow('jobs', {
      title: 'Transfers',
      icon: jobsIconUrl(),
      winType: 'jobs',
      params: {},
      width: STANDARD_WINDOW_W,
      height: STANDARD_WINDOW_H,
      x: jx,
      y: jy,
    });
  }, [isMobile, nav, wm]);

  const openSettings = useCallback(() => {
    if (isMobile) {
      nav.setShowingSettings(true);
      nav.setShowingTrash(false);
      nav.setShowingJobs(false);
      nav.setShowingMyPC(false);
      nav.setSelectedDriveName(null);
      return;
    }

    const { x: sx, y: sy } = getStandardWindowPos();
    wm.toggleWindow('settings', {
      title: 'Settings',
      icon: preferencesIconUrl(),
      winType: 'settings',
      params: {},
      width: STANDARD_WINDOW_W,
      height: STANDARD_WINDOW_H,
      x: sx,
      y: sy,
    });
  }, [isMobile, nav, wm]);

  const openPreview = useCallback(
    (entry: FileEntry, entries: FileEntry[] = [entry]) => {
      if (isMobile) {
        setPreviewEntries(entries);
        setPreviewEntry(entry);
        return;
      }

      const { x: px, y: py } = getStandardWindowPos();
      wm.toggleWindow('preview', {
        title: entry.name,
        icon: fileTypeIconUrl(entry),
        winType: 'preview',
        params: { entry, entries },
        width: STANDARD_WINDOW_W,
        height: STANDARD_WINDOW_H,
        x: px,
        y: py,
      });
    },
    [isMobile, setPreviewEntries, setPreviewEntry, wm],
  );

  const openService = useCallback(
    (service: ServiceShortcut) => {
      if (service.openMode === 'tab' || isMobile) {
        window.open(service.url, '_blank', 'noopener,noreferrer');
        return;
      }

      wm.openWindow({
        id: `service-${service.id}`,
        title: service.name,
        icon: service.iconUrl ?? '',
        winType: 'service',
        params: {
          name: service.name,
          url: service.url,
        },
        width: 980,
        height: 640,
      });
    },
    [isMobile, wm],
  );

  const openDesktop = useCallback(() => {
    if (isMobile) {
      navActions.resetToDesktopView();
      return;
    }

    wm.windows.forEach((win) => {
      if (!win.minimized) wm.toggleMinimize(win.id);
    });
  }, [isMobile, navActions, wm]);

  return {
    openDesktop,
    openDrives,
    openFiles,
    openJobs,
    openPreview,
    openService,
    openSettings,
    openTrash,
  };
}
