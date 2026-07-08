import { MouseEvent, useCallback, useMemo, useState } from 'react';
import type { FileEntry, TrashEntry } from '../api/client';
import { isArchiveFile } from '../utils/archive';

interface UseSelectionParams {
  filteredEntries: FileEntry[];
  trashEntries: TrashEntry[];
  favorites: string[];
  canWrite: boolean;
  currentPath: string;
}

export function useSelection({
  filteredEntries,
  trashEntries,
  favorites,
  canWrite,
  currentPath,
}: UseSelectionParams) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const [lastSelectedTrashId, setLastSelectedTrashId] = useState<string | null>(null);

  const selectedEntries = useMemo(
    () => filteredEntries.filter((e) => selectedPaths.includes(e.path)),
    [filteredEntries, selectedPaths],
  );

  const isFavorited = favorites.includes(currentPath);

  const handleSelectAll = useCallback(() => {
    const nextPaths = filteredEntries.map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1]! : null);
  }, [filteredEntries]);

  const handleInvertSelection = useCallback(() => {
    const nextPaths = filteredEntries
      .filter((entry) => !selectedPaths.includes(entry.path))
      .map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1]! : null);
  }, [filteredEntries, selectedPaths]);

  const handleFileClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    setSelectedPaths([]);
    setLastSelectedPath(null);
  }, []);

  const handleWorkspaceClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    setSelectedPaths([]);
    setLastSelectedPath(null);
  }, []);

  const handleContextMenuEvent = useCallback(
    (
      entry: FileEntry,
      event: MouseEvent<HTMLElement>,
      renaming: boolean,
    ): { blocked: boolean; shouldSelect: boolean } => {
      event.preventDefault();
      event.stopPropagation();
      if (renaming) return { blocked: true, shouldSelect: false };
      if (!selectedPaths.includes(entry.path)) {
        setSelectedPaths([entry.path]);
        setLastSelectedPath(entry.path);
        return { blocked: true, shouldSelect: true };
      }
      return { blocked: true, shouldSelect: false };
    },
    [selectedPaths],
  );

  const handleSelectTrashItem = useCallback(
    (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
      if (event.shiftKey && lastSelectedTrashId) {
        const allEntries = trashEntries;
        const from = allEntries.findIndex((e) => e.id === lastSelectedTrashId);
        const to = allEntries.findIndex((e) => e.id === entry.id);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedTrashIds(allEntries.slice(start, end + 1).map((e) => e.id));
          return;
        }
      }
      if (event.metaKey || event.ctrlKey) {
        setSelectedTrashIds((prev) =>
          prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id],
        );
        setLastSelectedTrashId(entry.id);
        return;
      }
      if (selectedTrashIds.includes(entry.id) && selectedTrashIds.length === 1) {
        setSelectedTrashIds([]);
        setLastSelectedTrashId(null);
        return;
      }
      setSelectedTrashIds([entry.id]);
      setLastSelectedTrashId(entry.id);
    },
    [trashEntries, lastSelectedTrashId, selectedTrashIds],
  );

  const canRename = selectedEntries.length === 1;
  const canDownload = selectedEntries.length === 1;
  const canDelete = selectedEntries.length > 0;
  const canCopy = selectedEntries.length > 0;
  const canMove = selectedEntries.length > 0;
  const canInfo = selectedEntries.length === 1;
  const canPreview = selectedEntries.length === 1 && selectedEntries[0]?.type === 'file';
  const canArchive = selectedEntries.length === 1;
  const canExtract =
    selectedEntries.length === 1 &&
    selectedEntries[0]?.type === 'file' &&
    isArchiveFile(selectedEntries[0]?.name ?? '');
  const canAnalyze = selectedEntries.length === 1 && selectedEntries[0]?.type === 'directory';
  const canChecksum = canWrite && selectedEntries.length === 1;
  const canPaste = canWrite; // clipboard check external

  return {
    selectedPaths,
    setSelectedPaths,
    lastSelectedPath,
    setLastSelectedPath,
    selectedTrashIds,
    setSelectedTrashIds,
    lastSelectedTrashId,
    setLastSelectedTrashId,
    selectedEntries,
    isFavorited,
    canRename,
    canDownload,
    canDelete,
    canCopy,
    canMove,
    canInfo,
    canPreview,
    canArchive,
    canExtract,
    canChecksum,
    canAnalyze,
    canPaste,
    handleSelectAll,
    handleInvertSelection,
    handleFileClick,
    handleWorkspaceClick,
    handleContextMenuEvent,
    handleSelectTrashItem,
  };
}
