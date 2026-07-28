import { useState, useMemo } from 'react';
import type { BlockDevice } from '../api/client-files';
import type { Job } from '../api/client-jobs';
import {
  filesIconUrl,
  jobsIconUrl,
  preferencesIconUrl,
  trashIconUrl,
  desktopDockIconUrl,
  storageAnalyzerIconUrl,
} from '../api/icons';
import { countActiveTransfers } from '../utils/jobs';
export type ActiveView =
  'desktop' | 'files' | 'trash' | 'settings' | 'jobs' | 'drives' | 'search' | 'storage-analyzer';

export function useNavigation(
  devices: BlockDevice[],
  jobs: Job[],
  trashCount: number,
  currentPath: string,
) {
  const [activeView, setActiveView] = useState<ActiveView>(currentPath ? 'files' : 'desktop');
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const topBarTitle = useMemo(() => {
    if (activeView === 'drives' && selectedDriveName) {
      const d = devices.find((dd) => dd.name === selectedDriveName);
      return d?.model || selectedDriveName;
    }
    if (activeView === 'drives') return 'Drives';
    if (activeView === 'search') return 'Search';
    if (activeView === 'storage-analyzer') return 'Storage Analyzer';
    if (activeView === 'trash') return 'Trash';
    if (activeView === 'settings') return 'Settings';
    if (activeView === 'jobs') return 'Transfers';
    if (activeView === 'files') return 'Files';
    return undefined;
  }, [activeView, selectedDriveName, devices]);

  const activeJobCount = useMemo(() => countActiveTransfers(jobs), [jobs]);

  const dockItems = useMemo(
    () => [
      {
        id: 'desktop',
        label: 'Desktop',
        icon: desktopDockIconUrl(),
        active: activeView === 'desktop',
      },
      { id: 'files', label: 'Files', icon: filesIconUrl(), active: activeView === 'files' },
      {
        id: 'trash',
        label: 'Trash',
        icon: trashIconUrl(trashCount > 0),
        badge: trashCount > 0 ? trashCount : undefined,
        active: activeView === 'trash',
      },
      {
        id: 'storage-analyzer',
        label: 'Space',
        icon: storageAnalyzerIconUrl(),
        active: activeView === 'storage-analyzer',
      },
      {
        id: 'jobs',
        label: 'Transfers',
        icon: jobsIconUrl(),
        badge: activeJobCount > 0 ? activeJobCount : undefined,
        active: activeView === 'jobs',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: preferencesIconUrl(),
        active: activeView === 'settings',
      },
    ],
    [activeView, trashCount, activeJobCount],
  );

  return {
    activeView,
    setActiveView,
    selectedDriveName,
    setSelectedDriveName,
    searchQuery,
    setSearchQuery,
    topBarTitle,
    activeJobCount,
    dockItems,
  };
}
