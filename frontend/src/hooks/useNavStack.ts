import { useCallback, useRef } from 'react';
import { getTrash } from '../api/client-files';
import type { SearchResult, TrashEntry } from '../api/client-files';
import type { ActiveView } from './useNavigation';

interface NavStackOptions {
  viewPref: {
    currentPath: string;
    setCurrentPath: (path: string) => void;
    navigateToPath: (path: string) => void;
  };
  nav?: {
    setActiveView: (view: ActiveView) => void;
    setSelectedDriveName: (v: string | null) => void;
  };
  browser: {
    refresh: () => void;
    setSearchOpen: (v: boolean) => void;
    setSearchResults: React.Dispatch<React.SetStateAction<SearchResult[] | null>>;
    setQuery: (v: string) => void;
    setTrashEntries: React.Dispatch<React.SetStateAction<TrashEntry[]>>;
  };
}

export function useNavStack({ viewPref, nav, browser }: NavStackOptions) {
  const backStackRef = useRef<string[]>([]);

  const refresh = useCallback(() => {
    browser.refresh();
    void getTrash().then((r) => browser.setTrashEntries(r.entries ?? []));
  }, [browser]);

  const navigateTo = useCallback(
    (path: string) => {
      if (viewPref.currentPath !== path) {
        backStackRef.current.push(viewPref.currentPath);
      }
      viewPref.navigateToPath(path);
      nav?.setActiveView('files');
      browser.setSearchOpen(false);
      browser.setSearchResults(null);
      browser.setQuery('');
      nav?.setSelectedDriveName(null);
    },
    [viewPref, nav, browser],
  );

  const resetToDesktopView = useCallback(() => {
    viewPref.setCurrentPath('');
    nav?.setActiveView('desktop');
    nav?.setSelectedDriveName(null);
  }, [viewPref, nav]);

  const goBack = useCallback(() => {
    const prev = backStackRef.current.pop();
    if (!prev) {
      resetToDesktopView();
    } else {
      viewPref.navigateToPath(prev);
      nav?.setActiveView('files');
      nav?.setSelectedDriveName(null);
    }
  }, [viewPref, nav, resetToDesktopView]);

  return { refresh, navigateTo, goBack, resetToDesktopView };
}
