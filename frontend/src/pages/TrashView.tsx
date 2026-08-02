import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderIcon, FileIcon } from '../components/ui/Icon';
import { AppPanel } from '../components/layout/AppPanel';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { trashIconUrl } from '../api/icons';
import type { TrashEntry } from '../api/client-files';
import { getTrash, restoreTrash, deleteTrash } from '../api/client-files';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatBytes, formatGridDate } from '../utils/format';
import { GRID_ICON_SIZE, GridTile } from '../components/ui/GridTile';
import { TrashContextMenu } from '../components/overlay/TrashContextMenu';
import { RefreshContextMenu } from '../components/overlay/RefreshContextMenu';
import { ConfirmDialog, type ConfirmDialogState } from '../components/overlay/ConfirmDialog';
import { useShellContext } from '../contexts/ShellContext';
import { useWindowId, useCommandsContext, type WindowCommands } from '../contexts/WindowCommands';
import { Skeleton } from '../components/ui/Skeleton';
import type { Job } from '../api/client-jobs';
import styles from './TrashView.module.css';

export function TrashView({ canWrite = true, jobs = [] }: { canWrite?: boolean; jobs?: Job[] }) {
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const [trashContextMenu, setTrashContextMenu] = useState<{
    entry: TrashEntry;
    x: number;
    y: number;
  } | null>(null);
  const [trashEmptyMenu, setTrashEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const shell = useShellContext();

  const {
    data: trashData,
    loading: trashLoading,
    error: trashError,
    refresh: loadTrash,
  } = useAsyncData(() => getTrash());

  useEffect(() => {
    if (trashData) setTrashEntries(trashData.entries ?? []);
  }, [trashData]);

  const restoreCompletionVersion = useMemo(
    () =>
      jobs
        .filter(
          (job) =>
            job.type === 'restore' &&
            (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'),
        )
        .map((job) => `${job.id}:${job.status}:${job.updatedAt}`)
        .join('|'),
    [jobs],
  );

  useEffect(() => {
    if (restoreCompletionVersion) loadTrash();
  }, [loadTrash, restoreCompletionVersion]);

  const handleSelectTrashItem = useCallback(
    (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
      setSelectedTrashIds((prev) => {
        const next = new Set(prev);
        if (event.ctrlKey || event.metaKey) {
          if (next.has(entry.id)) next.delete(entry.id);
          else next.add(entry.id);
        } else if (event.shiftKey && prev.size > 0) {
          const ids = trashEntries.map((e) => e.id);
          const lastIdx = ids.indexOf(Array.from(prev).pop()!);
          const curIdx = ids.indexOf(entry.id);
          if (lastIdx !== -1 && curIdx !== -1) {
            const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
            for (let i = start; i <= end; i++) next.add(ids[i]!);
          }
        } else {
          next.clear();
          next.add(entry.id);
        }
        return next;
      });
    },
    [trashEntries],
  );

  const handleTrashContextMenu = useCallback(
    (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canWrite) {
        setTrashContextMenu(null);
        setTrashEmptyMenu({ x: event.clientX, y: event.clientY });
        return;
      }
      setTrashEmptyMenu(null);
      setTrashContextMenu({ entry, x: event.clientX, y: event.clientY });
    },
    [canWrite],
  );

  const handleTrashEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setTrashContextMenu(null);
    setTrashEmptyMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleRestore = useCallback(
    (entry: TrashEntry) => {
      if (!canWrite) return;
      restoreTrash(entry.id)
        .then(() => {
          shell.showToastObj({ title: 'Restore queued', variant: 'success' });
          loadTrash();
        })
        .catch((err) =>
          shell.showToastObj({
            title: 'Failed to restore',
            variant: 'error',
            message: err.message,
          }),
        );
    },
    [canWrite, shell, loadTrash],
  );

  const deleteIds = useCallback(
    async (ids: string[], successTitle: string) => {
      const results = await Promise.allSettled(ids.map((id) => deleteTrash(id)));
      const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
      const deletedCount = ids.length - failedIds.length;

      if (deletedCount > 0) {
        shell.showToastObj({
          title:
            failedIds.length > 0
              ? `${deletedCount} item${deletedCount === 1 ? '' : 's'} deleted`
              : successTitle,
          variant: 'success',
        });
      }
      if (failedIds.length > 0) {
        shell.showToastObj({
          title: deletedCount > 0 ? 'Some items were not deleted' : 'Permanent deletion failed',
          variant: 'error',
          message: `${failedIds.length} item${failedIds.length === 1 ? '' : 's'} could not be deleted.`,
        });
      }
      setSelectedTrashIds(new Set(failedIds));
      loadTrash();
    },
    [loadTrash, shell],
  );

  const handleDeletePermanently = useCallback(
    (entry: TrashEntry) => {
      if (!canWrite) return;
      setConfirmDialog({
        title: 'Delete permanently?',
        message: `${entry.name} will be permanently deleted. This cannot be undone.`,
        confirmLabel: 'Delete permanently',
        danger: true,
        onConfirm: () => void deleteIds([entry.id], 'Deleted permanently'),
      });
    },
    [canWrite, deleteIds],
  );

  const handleRefresh = useCallback(() => {
    loadTrash();
    shell.showToastObj({ title: 'Refreshed', variant: 'success' });
  }, [loadTrash, shell]);

  const windowId = useWindowId();
  const { register: registerCommands, unregister: unregisterCommands } = useCommandsContext();

  const handleSelectAllTrash = useCallback(() => {
    setSelectedTrashIds(new Set(trashEntries.map((e) => e.id)));
  }, [trashEntries]);

  const handleInvertSelectionTrash = useCallback(() => {
    setSelectedTrashIds((prev) => {
      const ids = new Set(trashEntries.map((e) => e.id));
      for (const id of prev) ids.delete(id);
      return ids;
    });
  }, [trashEntries]);

  const handleRestoreSelected = useCallback(() => {
    if (!canWrite || selectedTrashIds.size === 0) return;
    const ids = Array.from(selectedTrashIds);
    Promise.allSettled(ids.map((id) => restoreTrash(id))).then((results) => {
      const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
      const queuedCount = ids.length - failedIds.length;
      if (queuedCount > 0) {
        shell.showToastObj({ title: 'Restore queued', variant: 'success' });
      }
      if (failedIds.length > 0) {
        shell.showToastObj({
          title: queuedCount > 0 ? 'Some restores were not queued' : 'Failed to restore',
          variant: 'error',
          message: `${failedIds.length} item${failedIds.length === 1 ? '' : 's'} could not be queued.`,
        });
      }
      setSelectedTrashIds(new Set(failedIds));
      loadTrash();
    });
  }, [canWrite, selectedTrashIds, shell, loadTrash]);

  const handleDeleteSelected = useCallback(() => {
    if (!canWrite || selectedTrashIds.size === 0) return;
    const ids = Array.from(selectedTrashIds);
    setConfirmDialog({
      title: `Delete ${ids.length} item${ids.length === 1 ? '' : 's'} permanently?`,
      message: 'The selected items will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      danger: true,
      onConfirm: () => void deleteIds(ids, 'Deleted permanently'),
    });
  }, [canWrite, deleteIds, selectedTrashIds]);

  const handleEmptyTrash = useCallback(() => {
    if (!canWrite || trashEntries.length === 0) return;
    const ids = trashEntries.map((entry) => entry.id);
    setConfirmDialog({
      title: 'Empty Trash?',
      message: `${ids.length} item${ids.length === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Empty Trash',
      danger: true,
      onConfirm: () => void deleteIds(ids, 'Trash emptied'),
    });
  }, [canWrite, deleteIds, trashEntries]);

  const selectedCount = selectedTrashIds.size;
  const commandSourcesRef = useRef({
    handleSelectAllTrash,
    handleInvertSelectionTrash,
    handleRestoreSelected,
    handleDeleteSelected,
    handleEmptyTrash,
  });
  commandSourcesRef.current = {
    handleSelectAllTrash,
    handleInvertSelectionTrash,
    handleRestoreSelected,
    handleDeleteSelected,
    handleEmptyTrash,
  };
  const windowCommands = useMemo<WindowCommands>(
    () => ({
      onSelectAll: () => commandSourcesRef.current.handleSelectAllTrash(),
      onInvertSelection: () => commandSourcesRef.current.handleInvertSelectionTrash(),
      onRestore: () => commandSourcesRef.current.handleRestoreSelected(),
      onDeleteForever: () => commandSourcesRef.current.handleDeleteSelected(),
      onEmptyTrash: () => commandSourcesRef.current.handleEmptyTrash(),
      canWrite,
      canUpload: false,
      selectedCount,
    }),
    [canWrite, selectedCount],
  );

  // Register window commands when inside a window
  useEffect(() => {
    if (!windowId) return;
    registerCommands(windowId, windowCommands);
    return () => unregisterCommands(windowId);
  }, [windowId, windowCommands, registerCommands, unregisterCommands]);

  const sortedTrashEntries = useMemo(() => {
    return [...trashEntries].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }, [trashEntries]);
  const initialLoading = trashLoading && !trashData;
  const showTrashGrid = !initialLoading && !trashError && trashEntries.length > 0;

  return (
    <>
      <AppPanel
        bodyClassName={
          initialLoading || showTrashGrid
            ? styles.trashGrid
            : trashEntries.length === 0 && !trashError
              ? styles.emptyWrapper
              : undefined
        }
        bodyProps={
          initialLoading
            ? { 'aria-label': 'Loading Trash', role: 'status' }
            : showTrashGrid
              ? {
                  onContextMenu: handleTrashEmptyContextMenu,
                  role: 'list',
                  tabIndex: -1,
                }
              : undefined
        }
        className={styles.trashPanel}
        padding="none"
        scroll={false}
      >
        {initialLoading ? (
          <Skeleton variant="card" count={8} />
        ) : trashError ? (
          <ErrorBanner message={trashError} onRetry={loadTrash} />
        ) : trashEntries.length === 0 ? (
          <EmptyState icon={trashIconUrl(false)} title="Trash is empty" />
        ) : (
          sortedTrashEntries.map((entry, idx) => {
            const isSelected = selectedTrashIds.has(entry.id);

            function handleTrashKeyDown(e: React.KeyboardEvent) {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSelectTrashItem(entry, e as unknown as React.MouseEvent<HTMLElement>);
                return;
              }
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = document.querySelectorAll<HTMLElement>(`[data-trash-id]`);
                const currentIdx = Array.from(items).indexOf(e.currentTarget as HTMLElement);
                const next =
                  e.key === 'ArrowDown'
                    ? Math.min(currentIdx + 1, items.length - 1)
                    : Math.max(currentIdx - 1, 0);
                items[next]?.focus();
              }
            }

            return (
              <GridTile
                key={entry.id}
                className={styles.trashItem}
                icon={
                  entry.type === 'directory' ? (
                    <FolderIcon size={GRID_ICON_SIZE} />
                  ) : (
                    <FileIcon
                      entry={{
                        name: entry.name,
                        type: entry.type,
                        path: entry.originalPath,
                        size: entry.size,
                        modifiedAt: entry.deletedAt,
                        permissions: '',
                        owner: '',
                        group: '',
                        hidden: false,
                      }}
                      size={GRID_ICON_SIZE}
                    />
                  )
                }
                name={entry.name}
                metadata={
                  <>
                    <span>{formatBytes(entry.size)}</span>
                    <span>{formatGridDate(entry.deletedAt)}</span>
                  </>
                }
                isSelected={isSelected}
                role="listitem"
                tabIndex={idx === 0 ? 0 : -1}
                data-trash-id={entry.id}
                onClick={(event) => handleSelectTrashItem(entry, event)}
                onContextMenu={(event) => handleTrashContextMenu(entry, event)}
                onKeyDown={handleTrashKeyDown}
              />
            );
          })
        )}
      </AppPanel>
      {trashContextMenu && (
        <TrashContextMenu
          x={trashContextMenu.x}
          y={trashContextMenu.y}
          onRestore={() => handleRestore(trashContextMenu.entry)}
          onDeletePermanently={() => handleDeletePermanently(trashContextMenu.entry)}
          onClose={() => setTrashContextMenu(null)}
        />
      )}
      {trashEmptyMenu && (
        <RefreshContextMenu
          x={trashEmptyMenu.x}
          y={trashEmptyMenu.y}
          onRefresh={handleRefresh}
          onClose={() => setTrashEmptyMenu(null)}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      )}
    </>
  );
}
