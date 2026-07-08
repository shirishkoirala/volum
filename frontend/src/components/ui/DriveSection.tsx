import type { BlockDevice } from '../../api/client';
import { DeviceIcon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import { formatBytes } from '../../utils/format';
import styles from './DriveSection.module.css';

type DriveSectionProps = {
  title: string;
  drives: BlockDevice[];
  onSelectDrive: (name: string) => void;
};

export function DriveSection({ title, drives, onSelectDrive }: DriveSectionProps) {
  if (drives.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.grid}>
        {drives.map((dev) => {
          const mountedParts =
            dev.partitions?.filter((p) => p.totalBytes != null && p.totalBytes > 0) ?? [];
          const aggTotal = mountedParts.reduce((sum, p) => sum + (p.totalBytes ?? 0), 0);
          const aggUsed = mountedParts.reduce((sum, p) => sum + (p.usedBytes ?? 0), 0);
          const aggFree = aggTotal - aggUsed;
          return (
            <button
              key={dev.name}
              className={styles.item}
              onClick={() => onSelectDrive(dev.name)}
              type="button"
            >
              <DeviceIcon name="drive-harddisk" size={64} />
              <div className={styles.info}>
                <span>{dev.model || dev.name}</span>
                <small>
                  {dev.size || ''}
                  {dev.transport ? ` · ${dev.transport.toUpperCase()}` : ''}
                  {dev.rotational ? ' · HDD' : ' · SSD'}
                  {(() => {
                    const c = dev.partitions?.filter((p) => p.volumPath).length ?? 0;
                    return c > 0 ? ` · ${c} volume${c !== 1 ? 's' : ''}` : '';
                  })()}
                </small>
                {aggTotal > 0 && (
                  <>
                    <small className={styles.usageText}>
                      {formatBytes(aggUsed)} used of {formatBytes(aggTotal)} ·{' '}
                      {formatBytes(aggFree)} free
                    </small>
                    <ProgressBar value={(aggUsed / aggTotal) * 100} className={styles.meter} />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
