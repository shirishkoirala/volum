import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { apiUrl } from '../../api/baseUrl';
import { EmptyState } from '../ui/EmptyState';
import { folderIconUrl } from '../../api/icons';
import { Button, IconButton, RotatedIcon } from '../ui/shared';
import styles from './FolderPicker.module.css';

export function FolderPicker({
  initialPath,
  onSelect,
  onClose,
  title = 'Select destination',
}: {
  initialPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const [currentDir, setCurrentDir] = useState(initialPath);
  const [subdirs, setSubdirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const pathParts = currentDir.split('/').filter(Boolean);

  const loadSubdirs = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ path, hidden: 'false' });
      const response = await fetch(apiUrl(`/api/files?${params.toString()}`));
      if (!response.ok) {
        throw new Error(`Failed to load folder (${response.status})`);
      }
      const data = await response.json();
      const dirs: string[] = (data.entries ?? [])
        .filter((e: { type: string }) => e.type === 'directory')
        .map((e: { path: string }) => e.path);
      setSubdirs(dirs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
      setSubdirs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubdirs(currentDir);
  }, [currentDir]);

  const navigateTo = (path: string) => {
    setHistory((prev) => [...prev, currentDir]);
    setCurrentDir(path);
  };

  const goUp = () => {
    if (pathParts.length <= 1) {
      const rootPath = currentDir.startsWith('/') ? '/' : '';
      setCurrentDir(rootPath);
      return;
    }
    const parent = '/' + pathParts.slice(0, -1).join('/');
    setCurrentDir(parent);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    if (prev === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setCurrentDir(prev);
  };

  return (
    <div className={styles.folderPicker}>
      <div className={styles.folderPickerHeader}>
        <span className={styles.folderPickerTitle}>{title}</span>
        <div className={styles.folderPickerNav}>
          <IconButton
            className={styles.folderPickerNavButton}
            onClick={goBack}
            disabled={history.length === 0}
            title="Back"
          >
            <RotatedIcon>
              <Icon name="go-next" size={16} />
            </RotatedIcon>
          </IconButton>
          <IconButton
            className={styles.folderPickerNavButton}
            onClick={goUp}
            disabled={currentDir === '/'}
            title="Up"
          >
            <RotatedIcon quarterTurns={1}>
              <Icon name="go-next" size={16} />
            </RotatedIcon>
          </IconButton>
          <IconButton
            className={styles.folderPickerNavButton}
            onClick={() => loadSubdirs(currentDir)}
            title="Refresh"
          >
            <Icon name="view-refresh" size={16} />
          </IconButton>
        </div>
      </div>
      <div className={styles.folderPickerBreadcrumb}>
        {pathParts.length === 0 ? (
          <span className={`${styles.folderPickerCrumb} ${styles.folderPickerCrumbActive}`}>/</span>
        ) : (
          <>
            <button
              type="button"
              className={styles.folderPickerCrumb}
              onClick={() => setCurrentDir('/')}
            >
              /
            </button>
            {pathParts.map((part, index) => {
              const path = '/' + pathParts.slice(0, index + 1).join('/');
              const isLast = index === pathParts.length - 1;
              return (
                <span key={path} className={styles.folderPickerCrumbRow}>
                  <Icon name="go-next" size={12} />
                  <button
                    type="button"
                    className={`${styles.folderPickerCrumb}${isLast ? ` ${styles.folderPickerCrumbActive}` : ''}`}
                    onClick={() => (isLast ? null : setCurrentDir(path))}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </>
        )}
      </div>
      <div className={styles.folderPickerBody}>
        {loading ? (
          <div className={styles.folderPickerLoading}>Loading...</div>
        ) : error ? (
          <div className={styles.folderPickerError}>
            {error}{' '}
            <Button variant="link" onClick={() => loadSubdirs(currentDir)}>
              Retry
            </Button>
          </div>
        ) : subdirs.length === 0 ? (
          <EmptyState compact icon={folderIconUrl('64')} title="No subdirectories" />
        ) : (
          subdirs.map((dir) => {
            const dirName = dir.split('/').filter(Boolean).pop() || dir;
            return (
              <button
                key={dir}
                type="button"
                className={styles.folderPickerItem}
                onClick={() => navigateTo(dir)}
                title={dir}
              >
                <Icon name="folder-new" size={18} />
                <span className={styles.truncate}>{dirName}</span>
              </button>
            );
          })
        )}
      </div>
      <div className={styles.folderPickerFooter}>
        <span className={`${styles.folderPickerPath} ${styles.truncate}`}>{currentDir}</span>
        <div className={styles.folderPickerActions}>
          <Button size="compact" onClick={onClose}>
            Cancel
          </Button>
          <Button size="compact" variant="primary" onClick={() => onSelect(currentDir)}>
            Choose
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FolderSuggestions({
  label,
  paths,
  onSelect,
}: {
  label: string;
  paths: string[];
  onSelect: (path: string) => void;
}) {
  return (
    <div className={styles.dialogSuggestions}>
      <span>{label}</span>
      <div>
        {paths.map((path) => (
          <button key={path} type="button" onClick={() => onSelect(path)} title={path}>
            {path === '/' ? '/' : path.split('/').filter(Boolean).pop() || path}
          </button>
        ))}
      </div>
    </div>
  );
}
