import { useState, useMemo } from 'react';
import type { BlockDevice, Job } from '../api/client';
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
  pendingTransferCount = 0,
) {
  const [showingTrash, setShowingTrash] = useState(false);
  const [showingSettings, setShowingSettings] = useState(false);
  const [showingJobs, setShowingJobs] = useState(false);
  const [showingMyPC, setShowingMyPC] = useState(false);
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);
  const [showingSearch, setShowingSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showingStorageAnalyzer, setShowingStorageAnalyzer] = useState(false);

  const topBarTitle = useMemo(() => {
    if (showingMyPC && selectedDriveName) {
      const d = devices.find((dd) => dd.name === selectedDriveName);
      return d?.model || selectedDriveName;
    }
    if (showingMyPC) return 'Drives';
    if (showingSearch) return 'Search';
    if (showingStorageAnalyzer) return 'Storage Analyzer';
    if (showingTrash) return 'Trash';
    if (showingSettings) return 'Settings';
    if (showingJobs) return 'Transfers';
    if (currentPath) return 'Files';
    return undefined;
  }, [
    showingMyPC,
    selectedDriveName,
    devices,
    showingSearch,
    showingTrash,
    showingSettings,
    showingJobs,
    showingStorageAnalyzer,
    currentPath,
  ]);

  const activeView = useMemo((): ActiveView => {
    if (showingSearch) return 'search';
    if (showingSettings) return 'settings';
    if (showingJobs) return 'jobs';
    if (showingStorageAnalyzer) return 'storage-analyzer';
    if (showingTrash) return 'trash';
    if (currentPath) return 'files';
    if (showingMyPC) return 'drives';
    return 'desktop';
  }, [
    currentPath,
    showingSearch,
    showingTrash,
    showingSettings,
    showingJobs,
    showingMyPC,
    showingStorageAnalyzer,
  ]);

  const activeJobCount = useMemo(() => countActiveTransfers(jobs), [jobs]);
  const transferBadgeCount = activeJobCount + pendingTransferCount;

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
        label: 'Storage',
        icon: storageAnalyzerIconUrl(),
        active: activeView === 'storage-analyzer',
      },
      {
        id: 'jobs',
        label: 'Transfers',
        icon: jobsIconUrl(),
        badge: transferBadgeCount > 0 ? transferBadgeCount : undefined,
        active: activeView === 'jobs',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: preferencesIconUrl(),
        active: activeView === 'settings',
      },
    ],
    [activeView, trashCount, transferBadgeCount],
  );

  return {
    showingTrash,
    setShowingTrash,
    showingSettings,
    setShowingSettings,
    showingJobs,
    setShowingJobs,
    showingMyPC,
    setShowingMyPC,
    selectedDriveName,
    setSelectedDriveName,
    showingSearch,
    setShowingSearch,
    searchQuery,
    setSearchQuery,
    showingStorageAnalyzer,
    setShowingStorageAnalyzer,
    topBarTitle,
    activeView,
    activeJobCount,
    dockItems,
  };
}
