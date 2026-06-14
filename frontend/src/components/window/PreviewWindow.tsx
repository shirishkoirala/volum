import type { FileEntry } from '../../api/client';
import { openFileExternally } from '../../utils/preview';
import { PreviewContent } from '../overlay/PreviewModal';

type PreviewWindowProps = {
  entry: FileEntry;
  entries?: FileEntry[];
  onSelectEntry?: (entry: FileEntry) => void;
  onShare?: (entry: FileEntry) => void;
};

export function PreviewWindow({ entry, entries = [entry], onSelectEntry, onShare }: PreviewWindowProps) {
  const currentIndex = entries.findIndex((candidate) => candidate.path === entry.path);
  const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
  const selectEntry = onSelectEntry;
  const canNavigate = entries.length > 1 && currentIndex >= 0 && selectEntry;
  const previousEntry = canNavigate && normalizedIndex > 0 ? entries[normalizedIndex - 1] : undefined;
  const nextEntry = canNavigate && normalizedIndex < entries.length - 1 ? entries[normalizedIndex + 1] : undefined;

  return (
    <PreviewContent
      entry={entry}
      onDownload={() => openFileExternally(entry.path)}
      onShare={onShare ? () => onShare(entry) : undefined}
      onPrevious={previousEntry && selectEntry ? () => selectEntry(previousEntry) : undefined}
      onNext={nextEntry && selectEntry ? () => selectEntry(nextEntry) : undefined}
      previousDisabled={!previousEntry}
      nextDisabled={!nextEntry}
      positionLabel={entries.length > 1 ? `${normalizedIndex + 1} of ${entries.length}` : undefined}
    />
  );
}
