import { useState, useMemo } from 'react';
import type { BlockDevice, Job } from '../api/client';
import { filesIconUrl, jobsIconUrl, preferencesIconUrl, trashIconUrl, desktopDockIconUrl } from '../api/icons';
export type ActiveView = 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';

export function useNavigation(
  devices: BlockDevice[],
  jobs: Job[],
  trashCount: number,
  currentPath: string,
) {
  const [showingTrash, setShowingTrash] = useState(false);
  const [showingSettings, setShowingSettings] = useState(false);
  const [showingJobs, setShowingJobs] = useState(false);
  const [showingMyPC, setShowingMyPC] = useState(false);
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);

  const topBarTitle = useMemo(() => {
    if (showingMyPC && selectedDriveName) {
      const d = devices.find(dd => dd.name === selectedDriveName);
      return d?.model || selectedDriveName;
    }
    if (showingMyPC) return 'Drives';
    if (showingTrash) return 'Trash';
    if (showingSettings) return 'Settings';
    if (showingJobs) return 'Transfers';
    if (currentPath) return 'Files';
    return undefined;
  }, [showingMyPC, selectedDriveName, devices, showingTrash, showingSettings, showingJobs, currentPath]);

  const activeView = useMemo((): ActiveView => {
    if (showingSettings) return 'settings';
    if (showingJobs) return 'jobs';
    if (showingTrash) return 'trash';
    if (currentPath) return 'files';
    return 'desktop';
  }, [currentPath, showingTrash, showingSettings, showingJobs]);

  const activeJobCount = useMemo(
    () => jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused').length,
    [jobs]
  );

  const dockItems = useMemo(() => [
    { id: 'desktop', label: 'Desktop', icon: desktopDockIconUrl(), active: activeView === 'desktop' },
    { id: 'files', label: 'Files', icon: filesIconUrl(), active: activeView === 'files' },
    { id: 'trash', label: 'Trash', icon: trashIconUrl(trashCount > 0), badge: trashCount > 0 ? trashCount : undefined, active: activeView === 'trash' },
    { id: 'jobs', label: 'Transfers', icon: jobsIconUrl(), badge: activeJobCount > 0 ? activeJobCount : undefined, active: activeView === 'jobs' },
    { id: 'settings', label: 'Settings', icon: preferencesIconUrl(), active: activeView === 'settings' },
  ], [activeView, trashCount, activeJobCount]);

  return {
    showingTrash, setShowingTrash,
    showingSettings, setShowingSettings,
    showingJobs, setShowingJobs,
    showingMyPC, setShowingMyPC,
    selectedDriveName, setSelectedDriveName,
    topBarTitle, activeView, activeJobCount, dockItems,
  };
}
