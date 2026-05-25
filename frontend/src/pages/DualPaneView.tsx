import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, FileIcon, FolderIcon } from '../components/ui/Icon';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { EmptyState } from '../components/ui/EmptyState';
import { folderIconUrl } from '../api/icons';
import { getFiles, createCopyJob, createMoveJob } from '../api/client';
import type { FileEntry, RootEntry } from '../api/client';
import { formatBytes } from '../utils/format';
import styles from './DualPaneView.module.css';

type DualPaneViewProps = {
  roots: RootEntry[];
  canWrite: boolean;
  onCopyJobCreated: () => void;
  onMoveJobCreated: () => void;
};

type PaneData = {
  currentPath: string;
  entries: FileEntry[];
  selectedPaths: string[];
  loading: boolean;
  error: string | null;
};

function PaneFileList({ entries, selectedPaths, onSelect }: {
  entries: FileEntry[];
  selectedPaths: string[];
  onSelect: (path: string, isDir: boolean) => void;
}) {
  if (entries.length === 0) {
    return <EmptyState icon={folderIconUrl('64')} title="This folder is empty" compact />;
  }
  return (
    <div className={styles.paneFileList}>
      {entries.map((entry) => (
        <div
          key={entry.path}
          className={`${styles.paneFileRow}${selectedPaths.includes(entry.path) ? ` ${styles.paneSelected}` : ''}`}
          onClick={() => onSelect(entry.path, entry.type === 'directory')}
        >
          {entry.type === 'directory' ? <FolderIcon size={18} /> : <FileIcon entry={entry} size={18} />}
          <span className={styles.paneFileName}>{entry.name}</span>
          <span className={styles.paneFileSize}>{entry.type !== 'directory' ? formatBytes(entry.size) : ''}</span>
        </div>
      ))}
    </div>
  );
}

export function DualPaneView({ roots, canWrite, onCopyJobCreated, onMoveJobCreated }: DualPaneViewProps) {
  const [leftPane, setLeftPane] = useState<PaneData>(() => ({
    currentPath: roots.find((r) => r.available)?.path || '',
    entries: [],
    selectedPaths: [],
    loading: false,
    error: null,
  }));
  const [rightPane, setRightPane] = useState<PaneData>(() => {
    const available = roots.filter((r) => r.available);
    const secondRoot = available.length > 1 ? available[1].path : available[0]?.path || '';
    return {
      currentPath: secondRoot,
      entries: [],
      selectedPaths: [],
      loading: false,
      error: null,
    };
  });
  const [dividerPos, setDividerPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadPane = useCallback(async (side: 'left' | 'right', path: string) => {
    const setPane = side === 'left' ? setLeftPane : setRightPane;
    setPane((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await getFiles(path, false);
      setPane((prev) => ({ ...prev, currentPath: path, entries: response.entries ?? [], loading: false, selectedPaths: [] }));
    } catch (err) {
      setPane((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Failed to load' }));
    }
  }, []);

  useEffect(() => {
    if (leftPane.currentPath && !leftPane.entries.length && !leftPane.loading) {
      loadPane('left', leftPane.currentPath);
    }
  }, [leftPane.currentPath, leftPane.entries.length, leftPane.loading, loadPane]);

  useEffect(() => {
    if (rightPane.currentPath && !rightPane.entries.length && !rightPane.loading) {
      loadPane('right', rightPane.currentPath);
    }
  }, [rightPane.currentPath, rightPane.entries.length, rightPane.loading, loadPane]);

  const handleNavigate = useCallback((side: 'left' | 'right', path: string) => {
    loadPane(side, path);
  }, [loadPane]);

  const handleSelect = useCallback((side: 'left' | 'right', path: string) => {
    const setPane = side === 'left' ? setLeftPane : setRightPane;
    setPane((prev) => ({
      ...prev,
      selectedPaths: prev.selectedPaths.includes(path)
        ? prev.selectedPaths.filter((p) => p !== path)
        : [...prev.selectedPaths, path],
    }));
  }, []);

  const handleCopyToOther = useCallback(async (side: 'left' | 'right') => {
    const src = side === 'left' ? leftPane : rightPane;
    const dst = side === 'left' ? rightPane : leftPane;
    if (!canWrite || src.selectedPaths.length === 0 || !dst.currentPath) return;
    try {
      for (const path of src.selectedPaths) {
        await createCopyJob(path, dst.currentPath, 'rename');
      }
      onCopyJobCreated();
    } catch { /* handled by caller */ }
  }, [leftPane, rightPane, canWrite, onCopyJobCreated]);

  const handleMoveToOther = useCallback(async (side: 'left' | 'right') => {
    const src = side === 'left' ? leftPane : rightPane;
    const dst = side === 'left' ? rightPane : leftPane;
    if (!canWrite || src.selectedPaths.length === 0 || !dst.currentPath) return;
    try {
      for (const path of src.selectedPaths) {
        await createMoveJob(path, dst.currentPath, 'rename');
      }
      setLeftPane((prev) => ({ ...prev, selectedPaths: [] }));
      setRightPane((prev) => ({ ...prev, selectedPaths: [] }));
      onMoveJobCreated();
    } catch { /* handled by caller */ }
  }, [leftPane, rightPane, canWrite, onMoveJobCreated]);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const onMove = (ev: globalThis.MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setDividerPos(Math.max(25, Math.min(75, pct)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const leftBreadcrumbs = leftPane.currentPath
    ? leftPane.currentPath.split('/').filter(Boolean).map((part, i, arr) => ({
        label: part,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))
    : [];

  const rightBreadcrumbs = rightPane.currentPath
    ? rightPane.currentPath.split('/').filter(Boolean).map((part, i, arr) => ({
        label: part,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))
    : [];

  return (
    <div className={styles.dualPaneContainer} ref={containerRef}>
      <div className={styles.pane} style={{ width: `calc(${dividerPos}% - 6px)` }}>
        <BreadcrumbBar
          crumbs={leftBreadcrumbs.length > 0 ? leftBreadcrumbs : [{ label: 'Desktop' }]}
          onBack={() => {
            const parts = leftPane.currentPath.split('/').filter(Boolean);
            handleNavigate('left', parts.length <= 1 ? '' : '/' + parts.slice(0, -1).join('/'));
          }}
          onNavigate={(path) => handleNavigate('left', path)}
        >
          {canWrite && leftPane.selectedPaths.length > 0 && rightPane.currentPath && (
            <>
              <button type="button" className={styles.paneActionBtn} onClick={() => handleCopyToOther('left')} title="Copy to right pane">
                <Icon name="edit-copy" size={16} /> Copy →
              </button>
              <button type="button" className={styles.paneActionBtn} onClick={() => handleMoveToOther('left')} title="Move to right pane">
                <Icon name="edit-cut" size={16} /> Move →
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.paneActionBtn}
            onClick={() => handleNavigate('left', leftPane.currentPath)}
            title="Refresh"
          >
            <Icon name="view-refresh" size={16} />
          </button>
        </BreadcrumbBar>
        {leftPane.loading ? (
          <div className={styles.paneLoading}>
            <Icon name="view-refresh" size={18} />
            <span>Loading...</span>
          </div>
        ) : leftPane.error ? (
          <div className={styles.paneError}>
            <Icon name="dialog-warning" size={18} />
            <span>{leftPane.error}</span>
          </div>
        ) : (
          <PaneFileList
            entries={leftPane.entries}
            selectedPaths={leftPane.selectedPaths}
            onSelect={(path, isDir) => {
              if (isDir) handleNavigate('left', path);
              else handleSelect('left', path);
            }}
          />
        )}
        {leftPane.currentPath && (
          <div className={styles.paneFooter}>
            <span>{leftPane.entries.length} item{leftPane.entries.length !== 1 ? 's' : ''}</span>
            {leftPane.selectedPaths.length > 0 && <span>{leftPane.selectedPaths.length} selected</span>}
          </div>
        )}
      </div>

      <div className={styles.divider} onMouseDown={handleDividerMouseDown}>
        <div className={styles.dividerHandle} />
      </div>

      <div className={styles.pane} style={{ width: `calc(${100 - dividerPos}% - 6px)` }}>
        <BreadcrumbBar
          crumbs={rightBreadcrumbs.length > 0 ? rightBreadcrumbs : [{ label: 'Desktop' }]}
          onBack={() => {
            const parts = rightPane.currentPath.split('/').filter(Boolean);
            handleNavigate('right', parts.length <= 1 ? '' : '/' + parts.slice(0, -1).join('/'));
          }}
          onNavigate={(path) => handleNavigate('right', path)}
        >
          {canWrite && rightPane.selectedPaths.length > 0 && leftPane.currentPath && (
            <>
              <button type="button" className={styles.paneActionBtn} onClick={() => handleCopyToOther('right')} title="Copy to left pane">
                ← <Icon name="edit-copy" size={16} /> Copy
              </button>
              <button type="button" className={styles.paneActionBtn} onClick={() => handleMoveToOther('right')} title="Move to left pane">
                ← <Icon name="edit-cut" size={16} /> Move
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.paneActionBtn}
            onClick={() => handleNavigate('right', rightPane.currentPath)}
            title="Refresh"
          >
            <Icon name="view-refresh" size={16} />
          </button>
        </BreadcrumbBar>
        {rightPane.loading ? (
          <div className={styles.paneLoading}>
            <Icon name="view-refresh" size={18} />
            <span>Loading...</span>
          </div>
        ) : rightPane.error ? (
          <div className={styles.paneError}>
            <Icon name="dialog-warning" size={18} />
            <span>{rightPane.error}</span>
          </div>
        ) : (
          <PaneFileList
            entries={rightPane.entries}
            selectedPaths={rightPane.selectedPaths}
            onSelect={(path, isDir) => {
              if (isDir) handleNavigate('right', path);
              else handleSelect('right', path);
            }}
          />
        )}
        {rightPane.currentPath && (
          <div className={styles.paneFooter}>
            <span>{rightPane.entries.length} item{rightPane.entries.length !== 1 ? 's' : ''}</span>
            {rightPane.selectedPaths.length > 0 && <span>{rightPane.selectedPaths.length} selected</span>}
          </div>
        )}
      </div>
    </div>
  );
}
