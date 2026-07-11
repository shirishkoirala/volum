import { FileContextMenu } from './FileContextMenu';
import { ConfirmDialog, TextInputDialog, TransferDialog } from './Dialogs';
import { ShareDialog } from './ShareDialog';
import { InfoPanel } from './InfoPanel';
import { PreviewModal } from './PreviewModal';
import { openFileExternally } from '../../utils/preview';
import type { FileEntry, ConflictPolicy } from '../../api/client';
import type { ConfirmDialogState, TextInputDialogState, TransferDialogState } from './Dialogs';

type C = {
  canWrite: boolean;
  canPreview: boolean;
  canInfo: boolean;
  canDownload: boolean;
  canRename: boolean;
  canArchive: boolean;
  canExtract: boolean;
  canChecksum: boolean;
  canCopy: boolean;
  canMove: boolean;
  canPaste: boolean;
  canDelete: boolean;
  canAnalyze: boolean;
};

export type SearchResultsOverlaysProps = {
  contextMenu: { x: number; y: number } | null;
  onContextMenuClose: () => void;
  caps: C;
  isFavorited: boolean;
  selectedCount: number;
  previewEntry: FileEntry | null;
  onPreviewClose: () => void;
  onPreviewShare: (entry: FileEntry) => void;
  onPreviewPrevious: (entry: FileEntry) => void;
  onPreviewNext: (entry: FileEntry) => void;
  infoEntry: FileEntry | null;
  onInfoClose: () => void;
  confirmDialog: ConfirmDialogState;
  onConfirmClose: () => void;
  textInputDialog: TextInputDialogState;
  onTextInputClose: () => void;
  transferDialog: TransferDialogState;
  folderSuggestions: string[];
  onTransferClose: () => void;
  onTransferSubmit: (
    dialog: TransferDialogState,
    destinationValue: string,
    conflictPolicy: ConflictPolicy,
  ) => void;
  shareDialogPath: { path: string; name: string } | null;
  onShareDialogClose: () => void;
  previousPreviewEntry: FileEntry | undefined;
  nextPreviewEntry: FileEntry | undefined;
  previewPositionLabel: string | undefined;
  onPreview: () => void;
  onShowInfo: () => void;
  onDownload: () => void;
  onRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onArchive: () => void;
  onExtract: () => void;
  onChecksum: () => void;
  onAnalyze: () => void;
  onQuickShare: () => void;
  onShare: () => void;
  onDelete: () => void;
};

export function SearchResultsOverlays({
  contextMenu,
  onContextMenuClose,
  caps,
  isFavorited,
  selectedCount,
  previewEntry,
  onPreviewClose,
  onPreviewShare,
  onPreviewPrevious,
  onPreviewNext,
  infoEntry,
  onInfoClose,
  confirmDialog,
  onConfirmClose,
  textInputDialog,
  onTextInputClose,
  transferDialog,
  folderSuggestions,
  onTransferClose,
  onTransferSubmit,
  shareDialogPath,
  onShareDialogClose,
  previousPreviewEntry,
  nextPreviewEntry,
  previewPositionLabel,
  onPreview,
  onShowInfo,
  onDownload,
  onRename,
  onCopy,
  onMove,
  onArchive,
  onExtract,
  onChecksum,
  onAnalyze,
  onQuickShare,
  onShare,
  onDelete,
}: SearchResultsOverlaysProps) {
  return (
    <>
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          caps={caps}
          isFavorited={isFavorited}
          selectedCount={selectedCount}
          onPreview={onPreview}
          onShowInfo={onShowInfo}
          onDownload={onDownload}
          onRename={onRename}
          onBatchRename={() => {}}
          onCopy={onCopy}
          onMove={onMove}
          onArchive={onArchive}
          onExtract={onExtract}
          onChecksum={onChecksum}
          onPaste={() => {}}
          onQuickShare={onQuickShare}
          onShare={onShare}
          onAnalyze={onAnalyze}
          onToggleFavorite={() => {}}
          onDelete={onDelete}
          onClose={onContextMenuClose}
        />
      )}

      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={onPreviewClose}
          onDownload={() => openFileExternally(previewEntry.path)}
          onShare={() => onPreviewShare(previewEntry)}
          onPrevious={
            previousPreviewEntry ? () => onPreviewPrevious(previousPreviewEntry) : undefined
          }
          onNext={nextPreviewEntry ? () => onPreviewNext(nextPreviewEntry) : undefined}
          previousDisabled={!previousPreviewEntry}
          nextDisabled={!nextPreviewEntry}
          positionLabel={previewPositionLabel}
        />
      )}
      {infoEntry && <InfoPanel entry={infoEntry} onClose={onInfoClose} onRefresh={() => {}} />}
      {confirmDialog && <ConfirmDialog dialog={confirmDialog} onClose={onConfirmClose} />}
      {textInputDialog && <TextInputDialog dialog={textInputDialog} onClose={onTextInputClose} />}
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
    </>
  );
}
