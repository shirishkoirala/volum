import { useEffect, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { SortField, SortDirection } from '../types';
import type { ViewMode } from '../utils/view';

type FolderPrefs = Record<string, { viewMode?: ViewMode; sortField?: SortField; sortDirection?: SortDirection }>;

export function useViewPreferences() {
  const [currentPath, setCurrentPath] = useLocalStorage('volum_currentPath', '');
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('volum_viewMode', 'grid' as ViewMode);
  const [sortField, setSortField] = useLocalStorage<SortField>('volum_sortField', 'name' as SortField);
  const [sortDirection, setSortDirection] = useLocalStorage<SortDirection>('volum_sortDirection', 'asc' as SortDirection);
  const [showHidden, setShowHidden] = useLocalStorage('volum_showHidden', false);
  const [folderPrefs, setFolderPrefs] = useLocalStorage<FolderPrefs>('volum_folderPrefs', {});
  const viewModeBeforeTrash = useRef<ViewMode | null>(null);

  useEffect(() => {
    if (currentPath && folderPrefs[currentPath]) {
      const prefs = folderPrefs[currentPath];
      if (prefs.viewMode) setViewMode(prefs.viewMode);
      if (prefs.sortField) setSortField(prefs.sortField);
      if (prefs.sortDirection) setSortDirection(prefs.sortDirection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const path = currentPath;
    if (path) {
      setFolderPrefs((prev) => ({ ...prev, [path]: { viewMode, sortField, sortDirection } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, viewMode, sortField, sortDirection]);

  return {
    currentPath, setCurrentPath,
    viewMode, setViewMode,
    sortField, setSortField,
    sortDirection, setSortDirection,
    showHidden, setShowHidden,
    folderPrefs, setFolderPrefs,
    viewModeBeforeTrash,
  };
}
