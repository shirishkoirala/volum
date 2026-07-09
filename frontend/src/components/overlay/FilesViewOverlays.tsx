import type { SetStateAction } from 'react';
import { FileContextMenu } from './FileContextMenu';
import { TrashContextMenu } from './TrashContextMenu';
import { FilesEmptyMenu } from './FilesEmptyMenu';
import { PreviewModal } from './PreviewModal';
import { InfoPanel } from './InfoPanel';
import { BatchRenameModal } from './BatchRenameModal';
import {
  ConfirmDialog,
  TextInputDialog,
  TransferDialog,
  type ConfirmDialogState,
  type TextInputDialogState,
  type TransferDialogState,
} from './Dialogs';
import { ShareDialog } from './ShareDialog';
import { ShareManager } from './ShareManager';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { DiskUsageAnalyzer } from './DiskUsageAnalyzer';
import { ProgressBar } from '../ui/ProgressBar';
import { formatBytes } from '../../utils/format';
import type { MenuCapabilities } from '../../types/capabilities';
import type { ConflictPolicy, FileEntry, TrashEntry } from '../../api/client';
import type { UploadProgress } from '../../utils/upload';
import styles from '../../pages/FilesView.module.css';

type FilesViewOverlaysProps = {
  contextMenu: { x: number; y: number; entry: FileEntry } | null;
  onContextMenuClose: () => void;
  trashContextMenu: { x: number; y: number; entry: TrashEntry } | null;
  onTrashContextMenuClose: () => void;
  filesEmptyMenu: { x: number; y: number } | null;
  onFilesEmptyMenuClose: () => void;
  canWrite: boolean;
  canUpload: boolean;
  caps: MenuCapabilities;
  selectedEntryIsFavorited: boolean;
  selectedCount: number;
  selectedEntries: FileEntry[];
  previewEntry: FileEntry | null;
  onPreviewClose: () => void;
  infoEntry: FileEntry | null;
  onInfoClose: () => void;
  batchRenameOpen: boolean;
  onBatchRenameClose: () => void;
  shortcutsOpen: boolean;
  onShortcutsClose: () => void;
  analyzePath: string | null;
  onAnalyzeClose: () => void;
  confirmDialog: ConfirmDialogState;
  onConfirmClose: () => void;
  textInputDialog: TextInputDialogState;
  onTextInputClose: () => void;
  transferDialog: TransferDialogState;
  folderSuggestions: string[];
  onTransferClose: () => void;
  shareDialogPath: { path: string; name: string } | null;
  onShareDialogClose: () => void;
  sharesOpen: boolean;
  onSharesClose: () => void;
  uploadProgress: UploadProgress | null;
  previousPreviewEntry: FileEntry | undefined;
  nextPreviewEntry: FileEntry | undefined;
  previewPositionLabel: string | undefined;
  onPreview: () => void;
  onShowInfo: () => void;
  onDownload: (entry?: FileEntry) => void;
  onRename: () => void;
  onBatchRename: () => void;
  onCopyPaths: () => void;
  onMovePaths: () => void;
  onArchive: () => void;
  onExtract: () => void;
  onChecksum: () => void;
  onPasteFiles: () => void;
  onQuickShare: () => void;
  onShare: (entry: FileEntry) => void;
  onAnalyze: () => void;
  onToggleFavorite: (entry: FileEntry) => void;
  onDelete: () => void;
  onRestoreTrash: (entry: TrashEntry) => void;
  onDeleteTrash: (entry: TrashEntry) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onUpload: () => void;
  onRefresh: () => void;
  onTransferSubmit: (
    dialog: TransferDialogState,
    destinationValue: string,
    conflictPolicy: ConflictPolicy,
  ) => void;
  setPreviewTarget: (value: SetStateAction<FileEntry | null>) => void;
  showToast: (toast: { title: string; variant: 'success' | 'error' | 'warning' }) => void;
};

export function FilesViewOverlays({
  contextMenu,
  onContextMenuClose,
  trashContextMenu,
  onTrashContextMenuClose,
  filesEmptyMenu,
  onFilesEmptyMenuClose,
  canWrite,
  canUpload,
  caps,
  selectedEntryIsFavorited,
  selectedCount,
  selectedEntries,
  previewEntry,
  onPreviewClose,
  infoEntry,
  onInfoClose,
  batchRenameOpen,
  onBatchRenameClose,
  shortcutsOpen,
  onShortcutsClose,
  analyzePath,
  onAnalyzeClose,
  confirmDialog,
  onConfirmClose,
  textInputDialog,
  onTextInputClose,
  transferDialog,
  folderSuggestions,
  onTransferClose,
  shareDialogPath,
  onShareDialogClose,
  sharesOpen,
  onSharesClose,
  uploadProgress,
  previousPreviewEntry,
  nextPreviewEntry,
  previewPositionLabel,
  onPreview,
  onShowInfo,
  onDownload,
  onRename,
  onBatchRename,
  onCopyPaths,
  onMovePaths,
  onArchive,
  onExtract,
  onChecksum,
  onPasteFiles,
  onQuickShare,
  onShare,
  onAnalyze,
  onToggleFavorite,
  onDelete,
  onRestoreTrash,
  onDeleteTrash,
  onCreateFolder,
  onCreateFile,
  onUpload,
  onRefresh,
  onTransferSubmit,
  setPreviewTarget,
  showToast,
}: FilesViewOverlaysProps) {
  return (
    <>
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          caps={caps}
          isFavorited={selectedEntryIsFavorited}
          selectedCount={selectedCount}
          onPreview={onPreview}
          onShowInfo={onShowInfo}
          onDownload={onDownload}
          onRename={onRename}
          onBatchRename={onBatchRename}
          onCopy={onCopyPaths}
          onMove={onMovePaths}
          onArchive={onArchive}
          onExtract={onExtract}
          onChecksum={onChecksum}
          onPaste={onPasteFiles}
          onQuickShare={onQuickShare}
          onShare={() => onShare(contextMenu.entry)}
          onAnalyze={onAnalyze}
          onToggleFavorite={() => onToggleFavorite(contextMenu.entry)}
          onDelete={onDelete}
          onClose={onContextMenuClose}
        />
      )}
      {trashContextMenu && canWrite && (
        <TrashContextMenu
          x={trashContextMenu.x}
          y={trashContextMenu.y}
          onRestore={() => onRestoreTrash(trashContextMenu.entry)}
          onDeletePermanently={() => onDeleteTrash(trashContextMenu.entry)}
          onClose={onTrashContextMenuClose}
        />
      )}
      {filesEmptyMenu && (
        <FilesEmptyMenu
          x={filesEmptyMenu.x}
          y={filesEmptyMenu.y}
          canWrite={canWrite}
          canUpload={canUpload}
          canPaste={caps.canPaste}
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onUpload={onUpload}
          onRefresh={onRefresh}
          onPaste={() => {
            onFilesEmptyMenuClose();
            onPasteFiles();
          }}
          onClose={onFilesEmptyMenuClose}
        />
      )}

      {uploadProgress && (
        <div className={styles.uploadProgress} role="status" aria-live="polite">
          <div className={styles.uploadProgressHeader}>
            <strong>Uploading</strong>
            <span>
              {Math.round(
                uploadProgress.total > 0
                  ? (uploadProgress.received / uploadProgress.total) * 100
                  : 0,
              )}
              %
            </span>
          </div>
          <span className={styles.uploadProgressName}>{uploadProgress.filename}</span>
          <ProgressBar
            value={
              uploadProgress.total > 0
                ? (uploadProgress.received / uploadProgress.total) * 100
                : 0
            }
            ariaLabel="Upload progress"
          />
          <span className={styles.uploadProgressMeta}>
            {formatBytes(uploadProgress.received)} of {formatBytes(uploadProgress.total)}
          </span>
        </div>
      )}

      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={onPreviewClose}
          onDownload={() => onDownload(previewEntry!)}
          onShare={() => onShare(previewEntry!)}
          onPrevious={
            previousPreviewEntry ? () => setPreviewTarget(previousPreviewEntry) : undefined
          }
          onNext={nextPreviewEntry ? () => setPreviewTarget(nextPreviewEntry) : undefined}
          previousDisabled={!previousPreviewEntry}
          nextDisabled={!nextPreviewEntry}
          positionLabel={previewPositionLabel}
        />
      )}
      {infoEntry && (
        <InfoPanel
          entry={infoEntry}
          onClose={onInfoClose}
          onRefresh={onRefresh}
        />
      )}
      {batchRenameOpen && (
        <BatchRenameModal
          entries={selectedEntries}
          onClose={onBatchRenameClose}
          onDone={() => {
            showToast({ title: 'Items renamed', variant: 'success' });
            onRefresh();
          }}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onClose={onConfirmClose}
        />
      )}
      {textInputDialog && (
        <TextInputDialog
          dialog={textInputDialog}
          onClose={onTextInputClose}
        />
      )}
      {transferDialog && (
        <TransferDialog
          dialog={transferDialog}
          folderSuggestions={folderSuggestions}
          onClose={onTransferClose}
          onSubmit={onTransferSubmit}
        />
      )}
      {shareDialogPath && (
        <ShareDialog
          path={shareDialogPath.path}
          name={shareDialogPath.name}
          onClose={onShareDialogClose}
        />
      )}
      {shortcutsOpen && (
        <KeyboardShortcuts onClose={onShortcutsClose} />
      )}
      {sharesOpen && <ShareManager onClose={onSharesClose} />}
      {analyzePath && (
        <DiskUsageAnalyzer
          path={analyzePath}
          onClose={onAnalyzeClose}
        />
      )}
    </>
  );
}
