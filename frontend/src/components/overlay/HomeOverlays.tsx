import type { SetStateAction } from 'react';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { PreviewModal } from './PreviewModal';
import { ShareDialog } from './ShareDialog';
import { ShareManager } from './ShareManager';
import { ServiceFormModal } from './ServiceFormModal';
import { openFileExternally } from '../../utils/preview';
import type { FileEntry } from '../../api/client';
import type { ServiceShortcut } from '../../utils/services';

type HomeOverlaysProps = {
  shareDialogPath: { path: string; name: string } | null;
  onShareDialogClose: () => void;
  previewEntry: FileEntry | null;
  onPreviewClose: () => void;
  onPreviewShare: (entry: FileEntry) => void;
  setPreviewEntry: (value: SetStateAction<FileEntry | null>) => void;
  previousPreviewEntry: FileEntry | undefined;
  nextPreviewEntry: FileEntry | undefined;
  previewPositionLabel: string | undefined;
  shortcutsOpen: boolean;
  onShortcutsClose: () => void;
  sharesOpen: boolean;
  onSharesClose: () => void;
  serviceFormData: { initial?: ServiceShortcut } | null;
  onServiceFormClose: () => void;
  onSaveService: (data: {
    name: string;
    url: string;
    iconUrl?: string;
    healthUrl?: string;
    description?: string;
    openMode: 'embed' | 'tab';
  }) => void;
};

export function HomeOverlays({
  shareDialogPath,
  onShareDialogClose,
  previewEntry,
  onPreviewClose,
  onPreviewShare,
  setPreviewEntry,
  previousPreviewEntry,
  nextPreviewEntry,
  previewPositionLabel,
  shortcutsOpen,
  onShortcutsClose,
  sharesOpen,
  onSharesClose,
  serviceFormData,
  onServiceFormClose,
  onSaveService,
}: HomeOverlaysProps) {
  return (
    <>
      {shareDialogPath && (
        <ShareDialog
          path={shareDialogPath.path}
          name={shareDialogPath.name}
          onClose={onShareDialogClose}
        />
      )}
      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={onPreviewClose}
          onDownload={() => openFileExternally(previewEntry.path)}
          onShare={() => onPreviewShare(previewEntry)}
          onPrevious={
            previousPreviewEntry ? () => setPreviewEntry(previousPreviewEntry) : undefined
          }
          onNext={nextPreviewEntry ? () => setPreviewEntry(nextPreviewEntry) : undefined}
          previousDisabled={!previousPreviewEntry}
          nextDisabled={!nextPreviewEntry}
          positionLabel={previewPositionLabel}
        />
      )}
      {shortcutsOpen && <KeyboardShortcuts onClose={onShortcutsClose} />}
      {sharesOpen && <ShareManager onClose={onSharesClose} />}
      {serviceFormData && (
        <ServiceFormModal
          initial={serviceFormData.initial}
          onSave={onSaveService}
          onClose={onServiceFormClose}
        />
      )}
    </>
  );
}
