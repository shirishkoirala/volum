import type { FileEntry } from '../../api/client';
import { openFileExternally } from '../../utils/preview';
import { PreviewContent } from '../overlay/PreviewModal';

type PreviewWindowProps = {
  entry: FileEntry;
};

export function PreviewWindow({ entry }: PreviewWindowProps) {
  return (
    <PreviewContent
      entry={entry}
      onDownload={() => openFileExternally(entry.path)}
    />
  );
}
