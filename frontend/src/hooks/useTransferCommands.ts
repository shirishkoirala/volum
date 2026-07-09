import { createJob, createShare, shareUrl } from '../api/client';
import type { FileEntry, ConflictPolicy } from '../api/client';
import { joinPath } from '../utils/path';
import type { ClipboardState } from './types';

type TransferDialogStateValue = {
  mode: 'copy' | 'move';
  entries: FileEntry[];
  initialDestination: string;
} | null;

type ContextMenuStateValue = {
  x: number;
  y: number;
  entry: FileEntry;
} | null;

type TransferCommandDeps = {
  runAction: (action: () => Promise<unknown>, successTitle?: string) => void;
  selectedEntries: FileEntry[];
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuStateValue>>;
  setTransferDialog: React.Dispatch<React.SetStateAction<TransferDialogStateValue>>;
  currentPath: string;
  canWrite: boolean;
  setFileClipboard: React.Dispatch<React.SetStateAction<ClipboardState>>;
  fileClipboard: ClipboardState | null;
  showToastObj: (toast: { title: string; message?: string; variant: 'success' | 'error' | 'warning' }, timeout?: number) => void;
  contextMenu: ContextMenuStateValue;
};

export function useTransferCommands(deps: TransferCommandDeps) {
  const {
    runAction,
    selectedEntries,
    setContextMenu,
    setTransferDialog,
    currentPath,
    canWrite,
    setFileClipboard,
    fileClipboard,
    showToastObj,
    contextMenu,
  } = deps;

  const handleCopy = () => {
    if (selectedEntries.length === 0) return;
    setContextMenu(null);
    setTransferDialog({
      mode: 'copy',
      entries: [...selectedEntries],
      initialDestination: currentPath,
    });
  };

  const handleMove = () => {
    if (selectedEntries.length === 0) return;
    setContextMenu(null);
    setTransferDialog({
      mode: 'move',
      entries: [...selectedEntries],
      initialDestination: currentPath,
    });
  };

  const setClipboardFromSelection = (mode: 'copy' | 'move') => {
    if (!canWrite || selectedEntries.length === 0) return;
    const entriesToStore = [...selectedEntries];
    setFileClipboard({ mode, entries: entriesToStore });
    showToastObj({
      title: mode === 'copy' ? 'Copied to clipboard' : 'Cut to clipboard',
      message: `${entriesToStore.length} item${entriesToStore.length === 1 ? '' : 's'}`,
      variant: 'success',
    });
  };

  const handlePaste = () => {
    if (!fileClipboard || !canWrite) return;
    setContextMenu(null);
    setTransferDialog({
      mode: fileClipboard.mode,
      entries: [...fileClipboard.entries],
      initialDestination: currentPath,
    });
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
      showToastObj({
        title: 'Quick share failed',
        message: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    }
  };

  const handleTransferSubmit = (
    dialog: TransferDialogStateValue,
    destinationValue: string,
    conflictPolicy: ConflictPolicy,
  ) => {
    if (!dialog) return;
    const destinations = destinationValue
      .split('|')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    if (destinations.length === 0) return;
    setTransferDialog(null);
    void runAction(
      async () => {
        for (const entry of dialog.entries) {
          for (const dest of destinations) {
            const targetPath = joinPath(dest, entry.name);
            await createJob({
              type: dialog.mode === 'copy' ? 'copy' : 'move',
              sourcePath: entry.path,
              destinationPath: targetPath,
              conflictPolicy,
              verifyMode: 'size',
            });
          }
        }
        if (dialog.mode === 'move') setFileClipboard(null);
      },
      dialog.mode === 'copy' ? 'Copy transfer started' : 'Move transfer started',
    );
  };

  return {
    handleCopy,
    handleMove,
    setClipboardFromSelection,
    handlePaste,
    handleQuickShare,
    handleTransferSubmit,
  };
}
