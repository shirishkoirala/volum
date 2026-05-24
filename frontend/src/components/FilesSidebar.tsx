import { Icon, FolderIcon, DeviceIcon } from './Icon';
import { ProgressBar } from './ProgressBar';
import type { BlockDevice, FileEntry } from '../api/client';
import styles from './FilesSidebar.module.css';

function formatBytes(value: number) {
  if (value == null || Number.isNaN(value) || value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDeviceUsage(part: BlockDevice) {
  if (part.totalBytes != null && part.totalBytes > 0) {
    const fsType = part.fsType ? ` · ${part.fsType}` : '';
    return `${formatBytes(part.usedBytes!)} used of ${formatBytes(part.totalBytes)} | ${formatBytes(part.freeBytes!)} free${fsType}`;
  }
  if (part.mountPoint) return 'Usage unavailable';
  return 'Not mounted';
}

type FilesSidebarProps = {
  devices: BlockDevice[];
  favorites: string[];
  recentPaths: string[];
  currentPath: string;
  subdirs: FileEntry[];
  sectionCollapsed: Record<string, boolean>;
  onToggleSection: (section: string) => void;
  onNavigate: (path: string) => void;
  onRemoveFavorite: (path: string) => void;
};

export function FilesSidebar({
  devices, favorites, recentPaths, currentPath, subdirs,
  sectionCollapsed, onToggleSection, onNavigate, onRemoveFavorite,
}: FilesSidebarProps) {
  return (
    <aside className={styles.filesSidebar}>
      <section className={`${styles.navSection}${sectionCollapsed.quick ? ` ${styles.sectionCollapsed}` : ''}`}>
        <div className={styles.sectionHeader} onClick={() => onToggleSection('quick')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onToggleSection('quick'); }}>
          <Icon name="go-next" size={14} className={`${styles.chevron}${sectionCollapsed.quick ? ` ${styles.chevronCollapsed}` : ''}`} aria-hidden="true" />
          <h2>Places</h2>
        </div>
        <div className={styles.sectionBody}>
          {favorites.map((path) => (
            <div className={path === currentPath ? `${styles.rootItem} ${styles.active}` : styles.rootItem} key={path} onClick={() => onNavigate(path)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(path); }}>
              <Icon name="bookmark-new" size={18} />
              <span className={styles.favDetails}>
                <span>{path.split('/').pop() || path}</span>
                <small>{path}</small>
              </span>
              <button className={styles.favRemove} onClick={(e) => { e.stopPropagation(); onRemoveFavorite(path); }} title="Remove from favorites" type="button">
                <Icon name="edit-delete" size={12} />
              </button>
            </div>
          ))}
          {recentPaths.slice(0, 5).map((path) => (
            <button className={path === currentPath ? `${styles.rootItem} ${styles.active}` : styles.rootItem} key={path} onClick={() => onNavigate(path)} type="button">
              <Icon name="document-open" size={18} />
              <span className={styles.favDetails}>
                <span>{path.split('/').pop() || path}</span>
                <small>{path}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={`${styles.navSection}${sectionCollapsed.storage ? ` ${styles.sectionCollapsed}` : ''}`}>
        <div className={styles.sectionHeader} onClick={() => onToggleSection('storage')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onToggleSection('storage'); }}>
          <Icon name="go-next" size={14} className={`${styles.chevron}${sectionCollapsed.storage ? ` ${styles.chevronCollapsed}` : ''}`} aria-hidden="true" />
          <h2>Removable</h2>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.rootList}>
            {devices.filter((dev) => dev.transport === 'usb').map((dev) => (
              <div key={dev.name} className={styles.deviceGroup}>
                <div className={styles.deviceHeader}>
                  <DeviceIcon name="drive-harddisk" size={18} />
                  <span className={styles.rootDetails}>
                    <span>{dev.model || dev.name}</span>
                    <small>{dev.size}{dev.transport ? ` · ${dev.transport.toUpperCase()}` : ''}{dev.rotational ? ' · HDD' : ' · SSD'}</small>
                  </span>
                </div>
                {dev.partitions?.map((part) => (
                  part.volumPath ? (
                    <button className={part.volumPath === currentPath ? `${styles.partitionItem} ${styles.active}` : styles.partitionItem} key={part.name} onClick={() => onNavigate(part.volumPath!)} type="button">
                      <FolderIcon size={18} />
                      <span className={styles.rootDetails}>
                        <span>{part.label || part.name}</span>
                        <small>{part.volumPath}</small>
                        <small>{formatDeviceUsage(part)}</small>
                        {part.totalBytes != null && part.totalBytes > 0 && (
                          <ProgressBar value={(part.usedBytes! / part.totalBytes!) * 100} className={styles.rootMeter} />
                        )}
                      </span>
                    </button>
                  ) : (
                    <div className={`${styles.partitionItem} ${styles.partitionUnmounted}`} key={part.name}>
                      <Icon name="media-removable" size={18} />
                      <span className={styles.rootDetails}>
                        <span>{part.name}</span>
                        <small>{part.size || 'Unknown'}</small>
                        <small>Not mounted</small>
                      </span>
                    </div>
                  )
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {currentPath && subdirs.length > 0 && (
        <section className={`${styles.navSection}${sectionCollapsed.folder ? ` ${styles.sectionCollapsed}` : ''}`}>
          <div className={styles.sectionHeader} onClick={() => onToggleSection('folder')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onToggleSection('folder'); }}>
            <Icon name="go-next" size={14} className={`${styles.chevron}${sectionCollapsed.folder ? ` ${styles.chevronCollapsed}` : ''}`} aria-hidden="true" />
            <h2>Current Folder</h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.rootList}>
              {subdirs.map((entry) => (
                <button className={entry.path === currentPath ? `${styles.rootItem} ${styles.active}` : styles.rootItem} key={entry.path} onClick={() => onNavigate(entry.path)} type="button">
                  <FolderIcon size={18} />
                  <span className={styles.favDetails}>
                    <span>{entry.name}</span>
                    <small>{entry.path}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </aside>
  );
}
