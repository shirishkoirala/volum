import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderIcon, FileIcon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { trashIconUrl } from '../api/icons';
import type { TrashEntry } from '../api/client';
import { getTrash, restoreTrash, deleteTrash } from '../api/client';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatBytes, formatGridDate } from '../utils/format';
import { useToasts } from '../hooks/useToasts';
import { GRID_ICON_SIZE, GridTile } from '../components/ui/GridTile';
import { TrashContextMenu } from '../components/overlay/TrashContextMenu';
import { TrashEmptyMenu } from '../components/overlay/TrashEmptyMenu';
import { useWindowId, useCommandsContext } from '../contexts/WindowCommands';
import styles from './TrashView.module.css';

export function TrashView() {
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const [trashContextMenu, setTrashContextMenu] = useState<{
    entry: TrashEntry;
    x: number;
    y: number;
  } | null>(null);
  const [trashEmptyMenu, setTrashEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const toast = useToasts();

  const { data: trashData, error: trashError, refresh: loadTrash } = useAsyncData(() => getTrash());

  useEffect(() => {
    if (trashData) setTrashEntries(trashData.entries ?? []);
  }, [trashData]);

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
      setTrashEmptyMenu(null);
      setTrashContextMenu({ entry, x: event.clientX, y: event.clientY });
    },
    [],
  );

  const handleTrashEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setTrashContextMenu(null);
    setTrashEmptyMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleRestore = useCallback(
    (entry: TrashEntry) => {
      restoreTrash(entry.id)
        .then(() => {
          toast.showToastObj({ title: 'Restore queued', variant: 'success' });
          loadTrash();
        })
        .catch((err) =>
          toast.showToastObj({
            title: 'Failed to restore',
            variant: 'error',
            message: err.message,
          }),
        );
    },
    [toast, loadTrash],
  );

  const handleDeletePermanently = useCallback(
    (entry: TrashEntry) => {
      deleteTrash(entry.id)
        .then(() => {
          toast.showToastObj({ title: 'Deleted permanently', variant: 'success' });
          loadTrash();
        })
        .catch((err) =>
          toast.showToastObj({ title: 'Failed to delete', variant: 'error', message: err.message }),
        );
    },
    [toast, loadTrash],
  );

  const handleRefresh = useCallback(() => {
    loadTrash();
    toast.showToastObj({ title: 'Refreshed', variant: 'success' });
  }, [loadTrash, toast]);

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
    if (selectedTrashIds.size === 0) return;
    const ids = Array.from(selectedTrashIds);
    Promise.all(ids.map((id) => restoreTrash(id)))
      .then(() => {
        toast.showToastObj({ title: 'Restore queued', variant: 'success' });
        setSelectedTrashIds(new Set());
        loadTrash();
      })
      .catch((err) =>
        toast.showToastObj({ title: 'Failed to restore', variant: 'error', message: err.message }),
      );
  }, [selectedTrashIds, toast, loadTrash]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedTrashIds.size === 0) return;
    const ids = Array.from(selectedTrashIds);
    Promise.all(ids.map((id) => deleteTrash(id)))
      .then(() => {
        toast.showToastObj({ title: 'Deleted permanently', variant: 'success' });
        setSelectedTrashIds(new Set());
        loadTrash();
      })
      .catch((err) =>
        toast.showToastObj({ title: 'Failed to delete', variant: 'error', message: err.message }),
      );
  }, [selectedTrashIds, toast, loadTrash]);

  const handleEmptyTrash = useCallback(() => {
    if (trashEntries.length === 0) return;
    Promise.all(trashEntries.map((e) => deleteTrash(e.id)))
      .then(() => {
        toast.showToastObj({ title: 'Trash emptied', variant: 'success' });
        setSelectedTrashIds(new Set());
        loadTrash();
      })
      .catch((err) =>
        toast.showToastObj({
          title: 'Failed to empty trash',
          variant: 'error',
          message: err.message,
        }),
      );
  }, [trashEntries, toast, loadTrash]);

  // Register window commands when inside a window
  useEffect(() => {
    if (!windowId) return;
    registerCommands(windowId, {
      onSelectAll: handleSelectAllTrash,
      onInvertSelection: handleInvertSelectionTrash,
      onRestore: handleRestoreSelected,
      onDeleteForever: handleDeleteSelected,
      onEmptyTrash: handleEmptyTrash,
      canWrite: true,
      canUpload: false,
      selectedCount: selectedTrashIds.size,
    });
    return () => unregisterCommands(windowId);
  }, [
    windowId,
    handleSelectAllTrash,
    handleInvertSelectionTrash,
    handleRestoreSelected,
    handleDeleteSelected,
    handleEmptyTrash,
    selectedTrashIds.size,
    registerCommands,
    unregisterCommands,
  ]);

  const sortedTrashEntries = useMemo(() => {
    return [...trashEntries].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }, [trashEntries]);

  return (
    <>
      {trashError ? (
        <ErrorBanner message={trashError} onRetry={loadTrash} />
      ) : trashEntries.length === 0 ? (
        <div className={`${styles.emptyWrapper} glassPanel mobileAppPanel`}>
          <EmptyState icon={trashIconUrl(false)} title="Trash is empty" />
        </div>
      ) : (
        <section
          className={`${styles.trashGrid} glassPanel mobileAppPanel`}
          onContextMenu={handleTrashEmptyContextMenu}
          tabIndex={-1}
          role="list"
        >
          {sortedTrashEntries.map((entry, idx) => {
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
                isDragOver={false}
                role="listitem"
                tabIndex={idx === 0 ? 0 : -1}
                data-trash-id={entry.id}
                onClick={(event) => handleSelectTrashItem(entry, event)}
                onContextMenu={(event) => handleTrashContextMenu(entry, event)}
                onKeyDown={handleTrashKeyDown}
              />
            );
          })}
        </section>
      )}
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
        <TrashEmptyMenu
          x={trashEmptyMenu.x}
          y={trashEmptyMenu.y}
          canPaste={false}
          onRefresh={handleRefresh}
          onPaste={() => {}}
          onClose={() => setTrashEmptyMenu(null)}
        />
      )}
    </>
  );
}
