import { DragEvent, KeyboardEvent, MouseEvent, RefObject, TouchEvent } from 'react';
import { FileItem } from './FileItem';
import type { FileEntry } from '../../api/client';
import { isPreviewableFile, openFileExternally } from '../../utils/preview';
import type { RenameState } from '../../types';
import styles from './FileListView.module.css';

type FileListViewProps = {
  filteredEntries: FileEntry[];
  selectedPaths: string[];
  onSelectEntry: (entry: FileEntry, event: MouseEvent<HTMLElement>) => void;
  onContextMenu: (entry: FileEntry, event: MouseEvent<HTMLElement>) => void;
  canWrite: boolean;
  onFileDragStart: (event: DragEvent<HTMLElement>, entry: FileEntry) => void;
  onFolderDragOver: (event: DragEvent<HTMLElement>, path: string) => void;
  onFolderDragLeave: () => void;
  onDropOnFolder: (event: DragEvent<HTMLElement>, path: string) => void;
  dragOverPath: string | null;
  favorites: string[];
  renameState: RenameState | null;
  renameInputRef?: RefObject<HTMLInputElement | null>;
  onSubmitRename: (entry: FileEntry) => void;
  onCancelRename: () => void;
  onRenameChange: (value: string) => void;
  fileGridRef?: RefObject<HTMLDivElement | null>;
  rubberBandStyle: React.CSSProperties | null;
  fileClick: (event: MouseEvent<HTMLElement>) => void;
  onFileAreaDragOver: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDragLeave: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDrop: (event: DragEvent<HTMLElement>) => void;
  onFileAreaMouseDown: (event: MouseEvent<HTMLElement>) => void;
  onFileAreaKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  draggingUpload: boolean;
  onEntryTouchStart?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchMove?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchEnd?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onNavigate: (path: string) => void;
  onPreview: (entry: FileEntry) => void;
};

function handleDoubleClick(entry: FileEntry, renameState: RenameState | null, onNavigate: (path: string) => void, onPreview: (entry: FileEntry) => void) {
  if (renameState) return;
  if (entry.type === 'directory') {
    onNavigate(entry.path);
    return;
  }
  if (isPreviewableFile(entry.name)) {
    onPreview(entry);
  } else {
    openFileExternally(entry.path);
  }
}

export function FileListView({
  filteredEntries, selectedPaths,
  onSelectEntry, onContextMenu,
  canWrite, onFileDragStart, onFolderDragOver, onFolderDragLeave, onDropOnFolder,
  dragOverPath, favorites,
  renameState, renameInputRef, onSubmitRename, onCancelRename, onRenameChange,
  fileGridRef, rubberBandStyle, fileClick,
  onFileAreaDragOver, onFileAreaDragLeave, onFileAreaDrop,
  onFileAreaMouseDown, onFileAreaKeyDown,
  draggingUpload,
  onEntryTouchStart, onEntryTouchMove, onEntryTouchEnd,
  onNavigate, onPreview,
}: FileListViewProps) {
  return (
    <section
      className={`${styles.fileList}${draggingUpload ? ` ${styles.dragOver}` : ''}`}
      ref={fileGridRef as RefObject<HTMLDivElement>}
      onClick={fileClick}
      onDragLeave={onFileAreaDragLeave}
      onDragOver={onFileAreaDragOver}
      onDrop={onFileAreaDrop}
      onMouseDown={onFileAreaMouseDown}
      onKeyDown={onFileAreaKeyDown}
      tabIndex={0}
    >
      {filteredEntries.map((entry) => (
        <FileItem
          key={entry.path}
          entry={entry}
          viewMode="list"
          isSelected={selectedPaths.includes(entry.path)}
          isDragOver={dragOverPath === entry.path}
          canWrite={canWrite}
          isFavorited={favorites.includes(entry.path)}
          renameState={renameState}
          renameInputRef={renameInputRef}
          onSelect={(event) => onSelectEntry(entry, event)}
          onContextMenu={(event) => onContextMenu(entry, event)}
          onDoubleClick={() => handleDoubleClick(entry, renameState, onNavigate, onPreview)}
          onDragStart={(event) => onFileDragStart(event, entry)}
          onDragOver={entry.type === 'directory' ? (event) => onFolderDragOver(event, entry.path) : undefined}
          onDragLeave={entry.type === 'directory' ? onFolderDragLeave : undefined}
          onDrop={entry.type === 'directory' ? (event) => onDropOnFolder(event, entry.path) : undefined}
          onTouchStart={onEntryTouchStart ? (event) => onEntryTouchStart(entry, event) : undefined}
          onTouchMove={onEntryTouchMove ? (event) => onEntryTouchMove(entry, event) : undefined}
          onTouchEnd={onEntryTouchEnd ? (event) => onEntryTouchEnd(entry, event) : undefined}
          onCommitRename={() => onSubmitRename(entry)}
          onCancelRename={onCancelRename}
          onRenameChange={onRenameChange}
        />
      ))}
      {rubberBandStyle && <div className={styles.rubberBand} style={rubberBandStyle} />}
    </section>
  );
}
