import type { FileEntry } from '../../api/client-files';
import { usePreviewNavigation } from '../../hooks/usePreviewNavigation';
import { openFileExternally } from '../../utils/preview';
import { PreviewContent } from '../overlay/PreviewModal';

type PreviewWindowProps = {
  entry: FileEntry;
  entries?: FileEntry[];
  onSelectEntry?: (entry: FileEntry) => void;
  onShare?: (entry: FileEntry) => void;
};

export function PreviewWindow({
  entry,
  entries = [entry],
  onSelectEntry,
  onShare,
}: PreviewWindowProps) {
  const { previewIndex, previewPositionLabel, previousPreviewEntry, nextPreviewEntry } =
    usePreviewNavigation(entry, entries);
  const normalizedIndex = previewIndex >= 0 ? previewIndex : 0;
  const selectEntry = onSelectEntry;
  const canNavigate = entries.length > 1 && previewIndex >= 0 && selectEntry;
  const previousEntry = canNavigate ? previousPreviewEntry : undefined;
  const nextEntry = canNavigate ? nextPreviewEntry : undefined;

  return (
    <PreviewContent
      entry={entry}
      onDownload={() => openFileExternally(entry.path)}
      onShare={onShare ? () => onShare(entry) : undefined}
      onPrevious={previousEntry && selectEntry ? () => selectEntry(previousEntry) : undefined}
      onNext={nextEntry && selectEntry ? () => selectEntry(nextEntry) : undefined}
      previousDisabled={!previousEntry}
      nextDisabled={!nextEntry}
      positionLabel={
        entries.length > 1
          ? (previewPositionLabel ?? `${normalizedIndex + 1} of ${entries.length}`)
          : undefined
      }
    />
  );
}
