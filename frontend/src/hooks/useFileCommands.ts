import { KeyboardEvent, useRef } from 'react';
import type { FileEntry, TrashEntry, ConflictPolicy } from '../api/client';
import {
  createFile, createFolder, createJob, deleteTrash, deletePath,
  getFiles, getJobs, getTrash, renamePath, restoreTrash,
  createShare,
  UploadCancelledError, UploadPausedError,
} from '../api/client';
import { uploadFilesWithResume, type UploadProgress } from '../utils/upload';
import { isPreviewableFile, openFileExternally } from '../utils/preview';
import { isArchiveFile, archiveBaseName, archiveFileName } from '../utils/archive';
import { joinPath, normalizeFolderPath } from '../utils/path';
import type { RenameState, ContextMenuState } from '../types';
import type { ConfirmDialogState, TextInputDialogState, TransferDialogState } from '../components/overlay/Dialogs';
import type { Toast } from '../components/overlay/Toast';

type ClipboardState = { mode: 'copy' | 'move'; entries: FileEntry[] } | null;

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

  // ── Upload ────────────────────────────────────────────

  const handleUploadFiles = (files: FileList | File[]) => {
    if (!canWrite) {
      console.error('Upload blocked: canWrite is false');
      setError('Upload requires admin permissions');
      showToastObj({ title: 'Upload failed', message: 'Admin permissions required', variant: 'error' });
      return;
    }
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) {
      console.error('Upload blocked: no files selected');
      return;
    }
    if (!currentPath) {
      console.error('Upload blocked: currentPath is', currentPath);
      setError('No destination folder selected');
      showToastObj({ title: 'Upload failed', message: 'Navigate to a folder first', variant: 'error' });
      return;
    }
    setPendingUploadCount((count) => count + selectedFiles.length);
    setUploadProgress({ filename: selectedFiles[0]?.name ?? 'Upload', received: 0, total: selectedFiles[0]?.size ?? 0 });
    showToastObj({
      title: 'Upload started',
      message: selectedFiles.length === 1 ? selectedFiles[0]!.name : `${selectedFiles.length} files`,
      variant: 'success',
    }, 6000);
    void runAction(async () => {
      let completedUploads = 0;
      try {
        await uploadFilesWithResume(currentPath, selectedFiles, undefined, setUploadProgress, () => {
          completedUploads += 1;
          setPendingUploadCount((count) => Math.max(0, count - 1));
        });
      } catch (err) {
        if (err instanceof UploadCancelledError || err instanceof UploadPausedError) return;
        throw err;
      } finally {
        const remainingUploads = selectedFiles.length - completedUploads;
        if (remainingUploads > 0) {
          setPendingUploadCount((count) => Math.max(0, count - remainingUploads));
        }
        setUploadProgress(null);
      }
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, `${selectedFiles.length} upload${selectedFiles.length === 1 ? '' : 's'} completed`);
  };

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
      await navigator.clipboard.writeText(`${window.location.origin}/api/public/${share.token}`);
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

  // ── Archive / Checksum ────────────────────────────────

  const handleCreateArchiveWithPreview = (entry: FileEntry, targetPath: string, archiveName: string) => {
    getFiles(currentPath, false).then((response) => {
      const entries2 = response.entries ?? [];
      const conflict = entries2.find((e) => e.name === archiveName);
      if (conflict) {
        setConfirmDialog({
          title: 'Archive Already Exists',
          message: `"${archiveName}" already exists in ${currentPath}. Overwrite it?`,
          confirmLabel: 'Overwrite',
          danger: true,
          onConfirm: () => { void runAction(() => createJob({ type: 'archive', sourcePath: entry.path, destinationPath: targetPath, conflictPolicy: 'overwrite' }), 'Archive transfer started'); }
        });
      } else {
        void runAction(() => createJob({ type: 'archive', sourcePath: entry.path, destinationPath: targetPath, conflictPolicy: 'rename' }), 'Archive transfer started');
      }
    }).catch(() => { void runAction(() => createJob({ type: 'archive', sourcePath: entry.path, destinationPath: targetPath, conflictPolicy: 'rename' }), 'Archive transfer started'); });
  };

  const handleCreateArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) return;
    const aName = archiveFileName(entry.name);
    const defaultPath = joinPath(currentPath, aName);
    setContextMenu(null);
    setTextInputDialog({
      title: 'Create Archive', label: 'Archive path', initialValue: defaultPath,
      placeholder: defaultPath, confirmLabel: 'Create Archive',
      folderSuggestions, suggestionLabel: 'Create in',
      applyFolderSuggestion: (path) => joinPath(path, aName),
      onSubmit: (value) => { handleCreateArchiveWithPreview(entry, value.trim(), aName); }
    });
  };

  const handleExtractArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1 || entry.type !== 'file' || !isArchiveFile(entry.name)) return;
    const defaultPath = joinPath(currentPath, archiveBaseName(entry.name));
    setContextMenu(null);
    setTextInputDialog({
      title: 'Extract Archive', label: 'Destination folder path',
      initialValue: defaultPath, placeholder: defaultPath, confirmLabel: 'Extract',
      folderSuggestions, suggestionLabel: 'Extract to',
      applyFolderSuggestion: (path) => normalizeFolderPath(path),
      onSubmit: (value) => {
        const dest = value.trim();
        getFiles(dest, false).then((response) => {
          const existing = response.entries ?? [];
          if (existing.length > 0) {
            setConfirmDialog({
              title: 'Destination Not Empty',
              message: `The destination folder contains ${existing.length} item${existing.length === 1 ? '' : 's'}. Extract here anyway? Existing files with the same name may be renamed.`,
              confirmLabel: 'Extract Anyway',
              onConfirm: () => { void runAction(() => createJob({ type: 'extract', sourcePath: entry.path, destinationPath: dest }), 'Extract transfer started'); }
            });
          } else {
            void runAction(() => createJob({ type: 'extract', sourcePath: entry.path, destinationPath: dest }), 'Extract transfer started');
          }
        }).catch(() => { void runAction(() => createJob({ type: 'extract', sourcePath: entry.path, destinationPath: dest }), 'Extract transfer started'); });
      }
    });
  };

  const handleAnalyze = () => {
    const entry = selectedEntries[0];
    if (!entry || entry.type !== 'directory') return;
    setContextMenu(null);
    setAnalyzePath(entry.path);
  };

  const handleCreateChecksum = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Generate Checksum', label: 'Verify mode', initialValue: 'sha256',
      placeholder: 'sha256', confirmLabel: 'Generate',
      onSubmit: (value) => {
        const mode = value.trim().toLowerCase() === 'md5' ? 'md5' : 'sha256';
        void runAction(() => createJob({ type: 'checksum', sourcePath: entry.path, verifyMode: mode }), `Checksum (${mode}) transfer started`);
      }
    });
  };

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
