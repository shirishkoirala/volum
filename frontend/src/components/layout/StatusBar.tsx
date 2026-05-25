import { formatBytes } from '../../utils/format';
import styles from './StatusBar.module.css';

type StatusBarProps = {
  visible: boolean;
  totalItems: number;
  selectedCount: number;
  totalBytes: number;
  rootAvail: number | null;
  rootSize: number | null;
  rootLabel: string;
  currentPath: string;
  viewContext: 'desktop' | 'files' | 'trash' | 'settings' | 'jobs' | 'dualPane';
  trashCount?: number;
};

export function StatusBar({
  visible, totalItems, selectedCount, totalBytes,
  rootAvail, rootSize, rootLabel, currentPath, viewContext, trashCount,
}: StatusBarProps) {
  if (!visible) return null;

  const itemText = (() => {
    if (viewContext === 'trash') {
      const count = trashCount ?? 0;
      return `${count} item${count === 1 ? '' : 's'}`;
    }
    if (viewContext === 'desktop') {
      return `${totalItems} item${totalItems === 1 ? '' : 's'}`;
    }
    if (selectedCount > 0) {
      return `${totalItems} item${totalItems === 1 ? '' : 's'} (${selectedCount} selected)`;
    }
    return `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  })();

  const storageText = (rootAvail != null && rootSize != null)
    ? `${formatBytes(rootAvail)} free of ${formatBytes(rootSize)}`
    : '';

  const bytesText = selectedCount > 0 && totalBytes > 0
    ? ` · ${formatBytes(totalBytes)}`
    : '';

  const pathText = rootLabel || currentPath;

  return (
    <footer className={styles.statusBar} role="status" aria-live="polite">
      <span className={styles.statusLeft}>
        {itemText}{bytesText}
      </span>
      {storageText && (
        <span className={styles.statusCenter}>{storageText}</span>
      )}
      {pathText && (
        <span className={styles.statusRight}>{pathText}</span>
      )}
    </footer>
  );
}
