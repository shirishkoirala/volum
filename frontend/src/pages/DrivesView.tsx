import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceIcon } from '../components/ui/Icon';
import { Button, IconImg, Notice } from '../components/ui/shared';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { DriveSection } from '../components/ui/DriveSection';
import { driveIconUrl, warningIconUrl } from '../api/icons';
import type { BlockDevice } from '../api/client';
import { getDevices } from '../api/client';
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
  const shell = useShellContext();

  const loadDevices = useCallback(() => {
    setDeviceError(null);
    getDevices()
      .then((res) => setDevices(res.devices ?? []))
      .catch((err) => setDeviceError(err.message))
      .finally(() => {});
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

  const handleNavigateTo = useCallback((path: string) => {
    shell.navigateTo(path);
  }, [shell]);

  if (selectedDriveName) {
    const d = devices.find(dd => dd.name === selectedDriveName);
    const driveLabel = d?.model || d?.name || selectedDriveName;
    return (
      <div className={styles.drivesWrapper}>
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: 'Drives' }, { label: driveLabel }]}
          onBack={() => setSelectedDriveName(null)}
          onNavigate={() => {}}
        />
        <div className={`${styles.drivesContainer} ${styles.partitionGrid}`}>
          {d?.partitions?.map((part) =>
            part.volumPath ? (
              <button key={part.name} className={styles.drivePartitionItem} onClick={() => handleNavigateTo(part.volumPath!)} type="button">
                <DeviceIcon name="drive-harddisk" size={32} />
                <span className={styles.drivePartitionInfo}>
                  <span>{part.label || part.name}</span>
                  <small>{part.volumPath}</small>
                  <small>{formatDeviceUsage(part)}</small>
                  {part.totalBytes != null && part.totalBytes > 0 && (
                    <ProgressBar value={(part.usedBytes! / part.totalBytes!) * 100} className={styles.drivePartitionMeter} />
                  )}
                </span>
              </button>
            ) : (
              <div key={part.name} className={`${styles.drivePartitionItem} ${styles.partitionUnmounted}`}>
                <IconImg src={driveIconUrl()} alt="" width={32} height={32} />
                <span className={styles.drivePartitionInfo}>
                  <span>{part.name}</span>
                  <small>{part.size || 'Unknown'}</small>
                  <small>Not mounted</small>
                </span>
              </div>
            )
          )}
          {(!d?.partitions?.length) && (
            <EmptyState icon={driveIconUrl()} title="No partitions found" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.drivesWrapper}>
      <BreadcrumbBar
        crumbs={[{ label: 'Desktop' }, { label: 'Drives' }]}
        onBack={handleBackToDesktop}
        onNavigate={() => {}}
      />
      <div className={`${styles.drivesContainer} ${styles.drivesList}`}>
        {deviceError && (
          <Notice variant="error">
            <IconImg src={warningIconUrl()} alt="" width={18} height={18} />
            <span>{deviceError}</span>
            <Button variant="danger" size="compact" onClick={loadDevices}>Retry</Button>
          </Notice>
        )}
        <DriveSection title="Internal" drives={internalDrives} onSelectDrive={setSelectedDriveName} />
        <DriveSection title="External" drives={externalDrives} onSelectDrive={setSelectedDriveName} />
        {internalDrives.length === 0 && externalDrives.length === 0 && (
          <EmptyState icon={driveIconUrl()} title="No drives found" />
        )}
      </div>
    </div>
  );
}
