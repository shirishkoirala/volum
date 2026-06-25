import { useCallback, useRef } from 'react';
import { getTrash } from '../api/client';

interface NavStackOptions {
  viewPref: {
    currentPath: string;
    setCurrentPath: (path: string) => void;
    navigateToPath: (path: string) => void;
  };
  nav?: {
    setShowingTrash: (v: boolean) => void;
    setShowingSettings: (v: boolean) => void;
    setShowingJobs: (v: boolean) => void;
    setShowingMyPC: (v: boolean) => void;
    setSelectedDriveName: (v: string | null) => void;
    setShowingSearch?: (v: boolean) => void;
  };
  browser: {
    refresh: () => void;
    setSearchOpen: (v: boolean) => void;
    setSearchResults: React.Dispatch<React.SetStateAction<import('../api/client').SearchResult[] | null>>;
    setQuery: (v: string) => void;
    setTrashEntries: React.Dispatch<React.SetStateAction<import('../api/client').TrashEntry[]>>;
  };
}

export function useNavStack({ viewPref, nav, browser }: NavStackOptions) {
  const backStackRef = useRef<string[]>([]);

  const refresh = useCallback(() => {
    browser.refresh();
    void getTrash().then((r) => browser.setTrashEntries(r.entries ?? []));
  }, [browser]);

  const navigateTo = useCallback((path: string) => {
    if (viewPref.currentPath !== path) {
      backStackRef.current.push(viewPref.currentPath);
    }
    viewPref.navigateToPath(path);
    nav?.setShowingTrash(false);
    nav?.setShowingSettings(false);
    nav?.setShowingJobs(false);
    nav?.setShowingSearch?.(false);
    browser.setSearchOpen(false);
    browser.setSearchResults(null);
    browser.setQuery('');
    nav?.setSelectedDriveName(null);
    nav?.setShowingMyPC(false);
  }, [viewPref, nav, browser]);

  const resetToDesktopView = useCallback(() => {
    viewPref.setCurrentPath('');
    nav?.setShowingTrash(false);
    nav?.setShowingSettings(false);
    nav?.setShowingJobs(false);
    nav?.setShowingSearch?.(false);
    nav?.setShowingMyPC(false);
    nav?.setSelectedDriveName(null);
  }, [viewPref, nav]);

  const goBack = useCallback(() => {
    const prev = backStackRef.current.pop();
    if (!prev) {
      resetToDesktopView();
    } else {
      viewPref.navigateToPath(prev);
    }
  }, [viewPref, resetToDesktopView]);

  return { refresh, navigateTo, goBack, resetToDesktopView };
}
