import { DragEvent, useCallback, useRef, useState } from 'react';
import type { FileEntry } from '../api/client';
import type { TransferDialogState } from '../components/overlay/Dialogs';

export function useDragDrop(
  canWrite: boolean,
  filteredEntries: FileEntry[],
  selectedPaths: string[],
  setTransferDialog: React.Dispatch<React.SetStateAction<TransferDialogState>>,
  handleUploadFiles: (files: FileList | File[]) => void,
  onUnsupportedDrop?: (message: string) => void,
) {
  const [draggingPaths, setDraggingPaths] = useState<string[] | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const selectedRef = useRef(selectedPaths);
  selectedRef.current = selectedPaths;
  const filteredRef = useRef(filteredEntries);
  filteredRef.current = filteredEntries;

  const isDraggingSelection = useRef(false);

  const hasDroppedDirectory = useCallback((items: DataTransferItemList) => {
    return Array.from(items).some((item) => {
      const maybeEntry = item as DataTransferItem & {
        webkitGetAsEntry?: () => { isDirectory?: boolean } | null;
      };
      return maybeEntry.webkitGetAsEntry?.()?.isDirectory === true;
    });
  }, []);

  const uploadDroppedFiles = useCallback((event: DragEvent<HTMLElement>) => {
    if (hasDroppedDirectory(event.dataTransfer.items)) {
      onUnsupportedDrop?.('Folder and app-bundle uploads are not supported yet');
      return;
    }
    handleUploadFiles(event.dataTransfer.files);
  }, [handleUploadFiles, hasDroppedDirectory, onUnsupportedDrop]);

  const handleFileDragStart = useCallback((event: DragEvent<HTMLElement>, entry: FileEntry) => {
    const paths = selectedRef.current.length > 0 ? selectedRef.current : [entry.path];
    setDraggingPaths(paths);
    isDraggingSelection.current = paths === selectedRef.current;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', paths.join('\n'));
  }, []);

  const handleFolderDragOver = useCallback((event: DragEvent<HTMLElement>, path: string) => {
    if (draggingPaths || event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverPath(path);
    }
  }, [draggingPaths]);

  const handleFolderDragLeave = useCallback(() => {
    setDragOverPath(null);
  }, []);

  const handleDropOnFolder = useCallback((event: DragEvent<HTMLElement>, folderPath: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverPath(null);
    setDraggingUpload(false);
    const paths = draggingPaths;
    if (paths && paths.length > 0) {
      const sourceEntries = paths.map((p) => {
        const found = filteredRef.current.find((e) => e.path === p);
        return found || {
          name: p.split('/').pop() || p, path: p, type: 'file' as const,
          size: 0, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false
        };
      }).filter(Boolean);
      if (sourceEntries.length > 0) {
        setTransferDialog({
          mode: isDraggingSelection.current ? 'move' : 'copy',
          entries: sourceEntries,
          initialDestination: folderPath,
        });
      }
      setDraggingPaths(null);
      return;
    }
    if (canWrite && event.dataTransfer.files.length > 0) {
      uploadDroppedFiles(event);
    }
  }, [draggingPaths, canWrite, uploadDroppedFiles, setTransferDialog]);

  const handleFileAreaDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (canWrite && event.dataTransfer.types.includes('Files')) {
      setDraggingUpload(true);
    }
  }, [canWrite]);

  const handleFileAreaDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDraggingUpload(false);
    }
  }, []);

  const handleFileAreaDrop = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDraggingUpload(false);
    if (!canWrite) return;
    uploadDroppedFiles(event);
  }, [canWrite, uploadDroppedFiles]);

  return {
    draggingPaths,
    dragOverPath,
    draggingUpload,
    handleFileDragStart,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleDropOnFolder,
    handleFileAreaDragOver,
    handleFileAreaDragLeave,
    handleFileAreaDrop,
  };
}
