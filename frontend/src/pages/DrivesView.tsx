import { useMemo } from 'react';
import { DeviceIcon } from '../components/ui/Icon';
import { Button, IconImg, Notice } from '../components/ui/shared';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { DriveSection } from '../components/ui/DriveSection';
import { driveIconUrl, warningIconUrl } from '../api/icons';
import type { BlockDevice } from '../api/client';
import { formatDeviceUsage } from '../utils/format';
import styles from './DrivesView.module.css';

type DrivesViewProps = {
  devices: BlockDevice[];
  selectedDriveName: string | null;
  onSelectDrive: (name: string | null) => void;
  onBackToDesktop: () => void;
  onNavigateTo: (path: string) => void;
  deviceError?: string | null;
  onRetryDevices?: () => void;
  wallpaperStyle?: React.CSSProperties;
};

export function DrivesView({
  devices, selectedDriveName,
  onSelectDrive, onBackToDesktop, onNavigateTo,
  deviceError, onRetryDevices, wallpaperStyle,
}: DrivesViewProps) {
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

  if (selectedDriveName) {
    const d = devices.find(dd => dd.name === selectedDriveName);
    const driveLabel = d?.model || d?.name || selectedDriveName;
    return (
      <div className={styles.drivesWrapper} style={wallpaperStyle}>
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: 'Drives' }, { label: driveLabel }]}
          onBack={() => onSelectDrive(null)}
          onNavigate={() => {}}
        />
        <div className={`${styles.drivesContainer} ${styles.partitionGrid}`}>
          {d?.partitions?.map((part) =>
            part.volumPath ? (
              <button key={part.name} className={styles.drivePartitionItem} onClick={() => onNavigateTo(part.volumPath!)} type="button">
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
    <div className={styles.drivesWrapper} style={wallpaperStyle}>
      <BreadcrumbBar
        crumbs={[{ label: 'Desktop' }, { label: 'Drives' }]}
        onBack={onBackToDesktop}
        onNavigate={() => {}}
      />
      <div className={`${styles.drivesContainer} ${styles.drivesList}`}>
        {deviceError && (
          <Notice variant="error">
            <IconImg src={warningIconUrl()} alt="" width={18} height={18} />
            <span>{deviceError}</span>
            {onRetryDevices && (
              <Button variant="danger" size="compact" onClick={onRetryDevices}>Retry</Button>
            )}
          </Notice>
        )}
        <DriveSection title="Internal" drives={internalDrives} onSelectDrive={onSelectDrive} />
        <DriveSection title="External" drives={externalDrives} onSelectDrive={onSelectDrive} />
        {internalDrives.length === 0 && externalDrives.length === 0 && (
          <EmptyState icon={driveIconUrl()} title="No drives found" />
        )}
      </div>
    </div>
  );
}
