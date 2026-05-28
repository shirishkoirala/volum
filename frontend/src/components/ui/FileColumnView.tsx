import { DragEvent, KeyboardEvent, RefObject } from 'react';
import { FileIcon, FolderIcon } from './Icon';
import type { FileEntry } from '../../api/client';
import { isPreviewableFile, openFileExternally } from '../../utils/preview';
import { buildColumnPath } from '../../utils/path';
import type { RenameState } from '../../types';
import styles from './FileColumnView.module.css';

type FileColumnViewProps = {
  currentPath: string;
  filteredEntries: FileEntry[];
  selectedPaths: string[];
  onContextMenu: (entry: FileEntry, event: React.MouseEvent<HTMLElement>) => void;
  onNavigate: (path: string) => void;
  onPreview: (entry: FileEntry) => void;
  renameState: RenameState | null;
  draggingUpload: boolean;
  fileGridRef?: RefObject<HTMLDivElement | null>;
  rubberBandStyle: React.CSSProperties | null;
  fileClick: (event: React.MouseEvent<HTMLElement>) => void;
  onFileAreaDragOver: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDragLeave: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDrop: (event: DragEvent<HTMLElement>) => void;
  onFileAreaMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  onFileAreaKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export function FileColumnView({
  currentPath, filteredEntries, selectedPaths,
  onContextMenu, onNavigate, onPreview,
  renameState,
  draggingUpload, fileGridRef, rubberBandStyle, fileClick,
  onFileAreaDragOver, onFileAreaDragLeave, onFileAreaDrop,
  onFileAreaMouseDown, onFileAreaKeyDown,
}: FileColumnViewProps) {
  return (
    <section
      className={`${styles.fileColumns}${draggingUpload ? ` ${styles.dragOver}` : ''}`}
      ref={fileGridRef as RefObject<HTMLDivElement>}
      onClick={fileClick}
      onDragLeave={onFileAreaDragLeave}
      onDragOver={onFileAreaDragOver}
      onDrop={onFileAreaDrop}
      onMouseDown={onFileAreaMouseDown}
      onKeyDown={onFileAreaKeyDown}
      tabIndex={0}
    >
      <div className={styles.columnBrowser}>
        {buildColumnPath(currentPath).map((col) => (
          <div key={col} className={styles.columnPane}>
            {col === currentPath ? (
              filteredEntries.map((entry) => (
                <div
                  className={`${styles.columnItem}${selectedPaths.includes(entry.path) ? ` ${styles.selected}` : ''}`}
                  key={entry.path}
                  onClick={() => {
                    if (renameState) return;
                    if (entry.type === 'directory') {
                      onNavigate(entry.path);
                    } else {
                      if (isPreviewableFile(entry.name)) {
                        onPreview(entry);
                      } else {
                        openFileExternally(entry.path);
                      }
                    }
                  }}
                  onContextMenu={(event) => onContextMenu(entry, event)}
                >
                  {entry.type === 'directory' ? <FolderIcon size={18} /> : <FileIcon entry={entry} size={18} />}
                  <span className={styles.truncate}>{entry.name}</span>
                </div>
              ))
            ) : (
              <div
                className={styles.columnItem}
                onClick={() => onNavigate(col)}
              >
                <FolderIcon size={18} />
                <span className={styles.truncate}>{col === '/' ? '/' : col.split('/').pop() || col}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {rubberBandStyle && <div className={styles.rubberBand} style={rubberBandStyle} />}
    </section>
  );
}
