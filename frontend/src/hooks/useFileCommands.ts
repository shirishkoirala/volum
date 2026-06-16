import { KeyboardEvent, useRef } from 'react';
import type { FileEntry, TrashEntry, ConflictPolicy } from '../api/client';
import {
  createFile, createFolder, createJob, deleteTrash, deletePath,
  getTrash, renamePath, restoreTrash,
  createShare, shareUrl,
} from '../api/client';
import type { UploadProgress } from '../utils/upload';
import { isPreviewableFile, openFileExternally } from '../utils/preview';
import { joinPath } from '../utils/path';
import type { RenameState, ContextMenuState } from '../types';
import type { ConfirmDialogState, TextInputDialogState, TransferDialogState } from '../components/overlay/Dialogs';
import type { Toast } from '../components/overlay/Toast';
import { useArchiveCommands } from './useArchiveCommands';
import { useUploadCommands } from './useUploadCommands';
import type { ClipboardState } from './types';

interface FileCommandDeps {
  currentPath: string;
  canWrite: boolean;
  folderSuggestions: string[];
  refresh: () => void;
  setError: (err: string | null) => void;
  setTrashEntries: React.Dispatch<React.SetStateAction<TrashEntry[]>>;
  setJobs: React.Dispatch<React.SetStateAction<import('../api/client').Job[]>>;
  selectedEntries: FileEntry[];
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  setLastSelectedPath: React.Dispatch<React.SetStateAction<string | null>>;
  renaming: RenameState;
  setRenaming: React.Dispatch<React.SetStateAction<RenameState>>;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
  setPreviewEntry: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  setInfoEntry: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  setBatchRenameOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAnalyzePath: React.Dispatch<React.SetStateAction<string | null>>;
  fileClipboard: ClipboardState;
  setFileClipboard: React.Dispatch<React.SetStateAction<ClipboardState>>;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
  setTextInputDialog: React.Dispatch<React.SetStateAction<TextInputDialogState>>;
  setTransferDialog: React.Dispatch<React.SetStateAction<TransferDialogState>>;
  setTrashContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; entry: TrashEntry } | null>>;
  setFilesEmptyMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgress | null>>;
  setPendingUploadCount: React.Dispatch<React.SetStateAction<number>>;
  showToastObj: (toast: Omit<Toast, 'id'>, timeout?: number) => void;
  contextMenu: ContextMenuState;
  navigateTo: (path: string) => void;
  selectedTrashIds: string[];
  setSelectedTrashIds: React.Dispatch<React.SetStateAction<string[]>>;
  setLastSelectedTrashId: React.Dispatch<React.SetStateAction<string | null>>;
  emptyMenuBlockedRef: React.MutableRefObject<boolean>;
}

function useCommandHelpers(deps: FileCommandDeps) {
  const runAction = async (action: () => Promise<unknown>, successTitle?: string) => {
    try {
      await action();
      deps.setError(null);
      if (successTitle) deps.showToastObj({ title: successTitle, variant: 'success' });
      deps.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      deps.setError(message);
      deps.showToastObj({ title: 'Action failed', message, variant: 'error' });
    }
  };

  return { runAction };
}

export function useFileCommands(deps: FileCommandDeps) {
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { runAction } = useCommandHelpers(deps);

  const {
    currentPath, canWrite, folderSuggestions, setError,
    setTrashEntries, setJobs, selectedEntries,
    setSelectedPaths, setLastSelectedPath,
    renaming, setRenaming, setContextMenu,
    setPreviewEntry, setInfoEntry, setBatchRenameOpen, setAnalyzePath,
    fileClipboard, setFileClipboard,
    setConfirmDialog, setTextInputDialog, setTransferDialog,
    setTrashContextMenu, setFilesEmptyMenu, setUploadProgress, setPendingUploadCount,
    showToastObj, contextMenu,
    navigateTo,
    selectedTrashIds, setSelectedTrashIds, setLastSelectedTrashId,
    emptyMenuBlockedRef,
  } = deps;

  // ── Folder / File creation ────────────────────────────

  const handleCreateFolder = () => {
    setContextMenu(null);
    setTextInputDialog({
      title: 'New Folder',
      label: 'Folder name',
      placeholder: 'Folder name',
      confirmLabel: 'Create',
      onSubmit: (value) => { void runAction(() => createFolder(currentPath, value.trim()), 'Folder created'); }
    });
  };

  const handleCreateFile = () => {
    setFilesEmptyMenu(null);
    setTextInputDialog({
      title: 'New Text File',
      label: 'File name',
      placeholder: 'file.txt',
      confirmLabel: 'Create',
      onSubmit: (value) => { void runAction(() => createFile(currentPath, value.trim()), 'File created'); }
    });
  };

  // ── Rename ────────────────────────────────────────────

  const handleRename = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) return;
    setContextMenu(null);
    setSelectedPaths([entry.path]);
    setLastSelectedPath(entry.path);
    setRenaming({ path: entry.path, value: entry.name });
  };

  const cancelRename = () => setRenaming(null);

  const commitRename = (entry: FileEntry) => {
    if (renaming?.path !== entry.path) return;
    const nextName = renaming.value.trim();
    if (!nextName || nextName === entry.name) { cancelRename(); return; }
    const oldName = entry.name;
    const oldPath = entry.path;
    setRenaming(null);
    void runAction(() => renamePath(oldPath, nextName), 'Item renamed');
    showToastObj({
      title: 'Item renamed', message: `${oldName} → ${nextName}`, variant: 'success',
      action: {
        label: 'Undo',
        onClick: () => { void runAction(() => renamePath(joinPath(oldPath.substring(0, oldPath.lastIndexOf('/')), nextName), oldName), 'Rename undone'); }
      }
    }, 8000);
  };

  // ── Delete ────────────────────────────────────────────

  const handleDelete = () => {
    if (selectedEntries.length === 0) return;
    const entriesToDelete = [...selectedEntries];
    const label = entriesToDelete.length === 1 ? `"${entriesToDelete[0]!.name}"` : `${entriesToDelete.length} selected items`;
    setConfirmDialog({
      title: 'Move to Trash',
      message: `Move ${label} to trash? You can restore it from the Trash panel.`,
      confirmLabel: 'Move to Trash',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          for (const entry of entriesToDelete) await deletePath(entry.path, entry.name);
          const response = await getTrash();
          setTrashEntries(response.entries ?? []);
        }, 'Moved to trash');
      }
    });
  };

  // ── Trash ─────────────────────────────────────────────

  const handleRestoreTrash = (entry: TrashEntry) => {
    void runAction(async () => { await restoreTrash(entry.id); const r = await getTrash(); setTrashEntries(r.entries ?? []); });
    showToastObj({ title: 'Item restored', message: entry.originalPath, variant: 'success', action: { label: 'Undo', onClick: () => { void deletePath(entry.originalPath, entry.name); getTrash().then((r) => setTrashEntries(r.entries ?? [])); showToastObj({ title: 'Restore undone', variant: 'success' }); } } }, 8000);
  };

  const handleDeleteTrash = (entry: TrashEntry) => {
    setTrashContextMenu(null);
    setConfirmDialog({
      title: 'Delete Permanently',
      message: `Permanently delete "${entry.name}"? This cannot be undone.`,
      confirmLabel: 'Delete Permanently', danger: true,
      onConfirm: () => { void runAction(async () => { await deleteTrash(entry.id); const r = await getTrash(); setTrashEntries(r.entries ?? []); }, 'Item deleted permanently'); }
    });
  };

  // ── Preview / Info / Download / Batch ─────────────────

  const handleDownload = (entry?: FileEntry) => {
    const fileEntry = entry ?? selectedEntries[0];
    if (!fileEntry) return;
    setConfirmDialog({
      title: 'Download File?',
      message: `Download "${fileEntry.name}"? This will open the file in a new browser tab.`,
      confirmLabel: 'Download',
      onConfirm: () => openFileExternally(fileEntry.path),
    });
  };

  const handlePreview = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry || entry.type !== 'file') return;
    if (isPreviewableFile(entry.name)) {
      setPreviewEntry(entry);
    } else {
      handleDownload(entry);
    }
  };

  const handleShowInfo = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) return;
    setContextMenu(null);
    setInfoEntry(entry);
  };

  const handleBatchRename = () => setBatchRenameOpen(true);

  const { handleUploadFiles } = useUploadCommands({
    currentPath,
    canWrite,
    setError,
    setJobs,
    setUploadProgress,
    setPendingUploadCount,
    showToastObj,
    runAction,
  });

  // ── Transfer / Clipboard ──────────────────────────────

  const handleCopy = () => {
    if (selectedEntries.length === 0) return;
    setContextMenu(null);
    setTransferDialog({ mode: 'copy', entries: [...selectedEntries], initialDestination: currentPath });
  };

  const handleMove = () => {
    if (selectedEntries.length === 0) return;
    setContextMenu(null);
    setTransferDialog({ mode: 'move', entries: [...selectedEntries], initialDestination: currentPath });
  };

  const setClipboardFromSelection = (mode: 'copy' | 'move') => {
    if (!canWrite || selectedEntries.length === 0) return;
    const entriesToStore = [...selectedEntries];
    setFileClipboard({ mode, entries: entriesToStore });
    showToastObj({ title: mode === 'copy' ? 'Copied to clipboard' : 'Cut to clipboard', message: `${entriesToStore.length} item${entriesToStore.length === 1 ? '' : 's'}`, variant: 'success' });
  };

  const handlePaste = () => {
    if (!fileClipboard || !canWrite) return;
    setContextMenu(null);
    setTransferDialog({ mode: fileClipboard.mode, entries: [...fileClipboard.entries], initialDestination: currentPath });
  };

  const handleQuickShare = async () => {
    const entry = contextMenu?.entry;
    if (!entry) return;
    setContextMenu(null);
    try {
      const share = await createShare({ path: entry.path });
      await navigator.clipboard.writeText(shareUrl(share.token));
      showToastObj({ title: 'Share link copied to clipboard', variant: 'success' });
    } catch (err) {
      showToastObj({ title: 'Quick share failed', message: err instanceof Error ? err.message : undefined, variant: 'error' });
    }
  };

  const handleTransferSubmit = (dialog: TransferDialogState, destinationValue: string, conflictPolicy: ConflictPolicy) => {
    if (!dialog) return;
    const destinations = destinationValue.split('|').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
    if (destinations.length === 0) return;
    setTransferDialog(null);
    void runAction(async () => {
      for (const entry of dialog.entries) {
        for (const dest of destinations) {
          const targetPath = joinPath(dest, entry.name);
          await createJob({
            type: dialog.mode === 'copy' ? 'copy' : 'move',
            sourcePath: entry.path,
            destinationPath: targetPath,
            conflictPolicy,
            verifyMode: 'size'
          });
        }
      }
      if (dialog.mode === 'move') setFileClipboard(null);
    }, dialog.mode === 'copy' ? 'Copy transfer started' : 'Move transfer started');
  };

  const {
    handleCreateArchive,
    handleExtractArchive,
    handleAnalyze,
    handleCreateChecksum,
  } = useArchiveCommands({
    currentPath,
    folderSuggestions,
    selectedEntries,
    setContextMenu,
    setTextInputDialog,
    setAnalyzePath,
    runAction,
  });

  // ── Trash context menu handler ────────────────────────

  const handleTrashContextMenu = (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    emptyMenuBlockedRef.current = true;
    queueMicrotask(() => { emptyMenuBlockedRef.current = false; });
    if (!selectedTrashIds.includes(entry.id)) {
      setSelectedTrashIds([entry.id]);
      setLastSelectedTrashId(entry.id);
    }
    setTrashContextMenu({ x: event.clientX, y: event.clientY, entry });
  };

  // ── File area keyboard ────────────────────────────────

  const handleFileAreaKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (renaming) { if (event.key === 'Escape') cancelRename(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); return; } // handled via handleSelectAll
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); setClipboardFromSelection('copy'); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') { event.preventDefault(); setClipboardFromSelection('move'); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); handlePaste(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') { event.preventDefault(); return; } // handled via handleInvertSelection
    if (event.key === 'F2' && canWrite && deps.selectedEntries.length === 1) { event.preventDefault(); handleRename(); return; }
    if (event.key === 'Delete' && canWrite && deps.selectedEntries.length > 0) { event.preventDefault(); handleDelete(); return; }
    if (event.key === 'Escape') { setSelectedPaths([]); setContextMenu(null); setLastSelectedPath(null); return; }
    if (event.key === 'Enter' && selectedEntries.length === 1) {
      const entry = selectedEntries[0]!;
      if (entry.type === 'directory') navigateTo(entry.path);
      else handlePreview();
    }
  };

  return {
    renameInputRef,
    runAction,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    commitRename,
    cancelRename,
    handleDelete,
    handleRestoreTrash,
    handleDeleteTrash,
    handlePreview,
    handleDownload,
    handleShowInfo,
    handleBatchRename,
    handleCopy,
    handleMove,
    setClipboardFromSelection,
    handlePaste,
    handleQuickShare,
    handleTransferSubmit,
    handleCreateArchive,
    handleExtractArchive,
    handleAnalyze,
    handleCreateChecksum,
    handleUploadFiles,
    handleFileAreaKeyDown,
    handleTrashContextMenu,
  };
}
