import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceIcon } from '../components/ui/Icon';
import { IconImg } from '../components/ui/shared';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { AppPanel } from '../components/layout/AppPanel';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { DriveSection } from '../components/ui/DriveSection';
import { Skeleton } from '../components/ui/Skeleton';
import { driveIconUrl } from '../api/icons';
import type { BlockDevice } from '../api/client-files';
import { getDevices } from '../api/client-files';
import { formatDeviceUsage } from '../utils/format';
import { useShellContext } from '../contexts/ShellContext';
import styles from './DrivesView.module.css';

type DrivesViewProps = {
  onBackToDesktop?: () => void;
};

export function DrivesView({ onBackToDesktop }: DrivesViewProps) {
  const [devices, setDevices] = useState<BlockDevice[]>([]);
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const shell = useShellContext();

  const loadDevices = useCallback(() => {
    setLoading(true);
    setDeviceError(null);
    getDevices()
      .then((res) => setDevices(res.devices ?? []))
      .catch((err: Error) => setDeviceError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const { internalDrives, externalDrives } = useMemo(() => {
    const internal: BlockDevice[] = [];
    const external: BlockDevice[] = [];
    for (const dev of devices) {
      const t = (dev.transport || '').toLowerCase();
      if (t === 'usb' || t === 'firewire' || t === 'thunderbolt') {
        external.push(dev);
      } else {
        internal.push(dev);
      }
    }
    return { internalDrives: internal, externalDrives: external };
  }, [devices]);

  const handleBackToDesktop = useCallback(() => {
    if (onBackToDesktop) {
      onBackToDesktop();
      return;
    }
    shell.navigateTo('desktop');
  }, [onBackToDesktop, shell]);

  const handleNavigateTo = useCallback(
    (path: string) => {
      shell.navigateTo(path);
    },
    [shell],
  );

  if (selectedDriveName) {
    const d = devices.find((dd) => dd.name === selectedDriveName);
    const driveLabel = d?.model || d?.name || selectedDriveName;
    return (
      <AppPanel
        bodyClassName={styles.partitionGrid}
        header={
          <BreadcrumbBar
            crumbs={[{ label: 'Desktop' }, { label: 'Drives' }, { label: driveLabel }]}
            onBack={() => setSelectedDriveName(null)}
            onNavigate={() => {}}
          />
        }
      >
        {d?.partitions?.map((part) =>
          part.volumPath ? (
            <button
              key={part.name}
              className={styles.drivePartitionItem}
              onClick={() => handleNavigateTo(part.volumPath!)}
              type="button"
            >
              <DeviceIcon name="drive-harddisk" size={32} />
              <span className={styles.drivePartitionInfo}>
                <span>{part.label || part.name}</span>
                <small>{part.volumPath}</small>
                <small>{formatDeviceUsage(part)}</small>
                {part.totalBytes != null && part.totalBytes > 0 && (
                  <ProgressBar
                    value={(part.usedBytes! / part.totalBytes!) * 100}
                    className={styles.drivePartitionMeter}
                  />
                )}
              </span>
            </button>
          ) : (
            <div
              key={part.name}
              className={`${styles.drivePartitionItem} ${styles.partitionUnmounted}`}
            >
              <IconImg src={driveIconUrl()} alt="" width={32} height={32} />
              <span className={styles.drivePartitionInfo}>
                <span>{part.name}</span>
                <small>{part.size || 'Unknown'}</small>
                <small>Not mounted</small>
              </span>
            </div>
          ),
        )}
        {!d?.partitions?.length && <EmptyState icon={driveIconUrl()} title="No partitions found" />}
      </AppPanel>
    );
  }

  return (
    <AppPanel
      bodyClassName={styles.drivesList}
      header={
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: 'Drives' }]}
          onBack={handleBackToDesktop}
          onNavigate={() => {}}
        />
      }
    >
      {loading ? (
        <div className={styles.skeletonGrid} aria-hidden="true">
          <Skeleton variant="card" count={6} height="112px" />
        </div>
      ) : deviceError ? (
        <ErrorBanner message={deviceError} onRetry={loadDevices} />
      ) : internalDrives.length === 0 && externalDrives.length === 0 ? (
        <EmptyState icon={driveIconUrl()} title="No drives found" />
      ) : (
        <>
          <DriveSection
            title="Internal"
            drives={internalDrives}
            onSelectDrive={setSelectedDriveName}
          />
          <DriveSection
            title="External"
            drives={externalDrives}
            onSelectDrive={setSelectedDriveName}
          />
        </>
      )}
    </AppPanel>
  );
}
