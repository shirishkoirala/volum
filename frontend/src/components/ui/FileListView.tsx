import { DragEvent, KeyboardEvent, RefObject, TouchEvent, useEffect, useLayoutEffect, useMemo } from 'react';
import { FileItem } from './FileItem';
import type { FileEntry } from '../../api/client';
import { isPreviewableFile, openFileExternally } from '../../utils/preview';
import type { RenameState } from '../../types';
import { useIncrementalEntries } from '../../hooks/useIncrementalEntries';
import styles from './FileListView.module.css';

type FileListViewProps = {
  filteredEntries: FileEntry[];
  selectedPaths: string[];
  onContextMenu: (entry: FileEntry, event: React.MouseEvent<HTMLElement>) => void;
  onEmptyContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
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
  fileClick: (event: React.MouseEvent<HTMLElement>) => void;
  onFileAreaDragOver: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDragLeave: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDrop: (event: DragEvent<HTMLElement>) => void;
  onFileAreaMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  onFileAreaKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  draggingUpload: boolean;
  totalEntries?: number;
  loadingMore?: boolean;
  onLoadMoreEntries?: () => void;
  onVisibleCountChange?: (renderedCount: number, totalCount: number) => void;
  resetKey?: string;
  onEntryTouchStart?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchMove?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchEnd?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onNavigate: (path: string) => void;
  onPreview: (entry: FileEntry) => void;
};

function handleFileClick(entry: FileEntry, renameState: RenameState | null, onNavigate: (path: string) => void, onPreview: (entry: FileEntry) => void) {
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
  onContextMenu, onEmptyContextMenu,
  canWrite, onFileDragStart, onFolderDragOver, onFolderDragLeave, onDropOnFolder,
  dragOverPath, favorites,
  renameState, renameInputRef, onSubmitRename, onCancelRename, onRenameChange,
  fileGridRef, rubberBandStyle, fileClick,
  onFileAreaDragOver, onFileAreaDragLeave, onFileAreaDrop,
  onFileAreaMouseDown, onFileAreaKeyDown,
  draggingUpload,
  totalEntries, loadingMore, onLoadMoreEntries, onVisibleCountChange, resetKey,
  onEntryTouchStart, onEntryTouchMove, onEntryTouchEnd,
  onNavigate, onPreview,
}: FileListViewProps) {
  const incrementalEntries = useIncrementalEntries(filteredEntries, {
    totalCount: totalEntries,
    loadingMore,
    onLoadMore: onLoadMoreEntries,
    resetKey,
  });
  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const favoritePathSet = useMemo(() => new Set(favorites), [favorites]);

  useLayoutEffect(() => {
    if (!fileGridRef?.current) return;
    fileGridRef.current.scrollTop = 0;
    fileGridRef.current.ownerDocument.defaultView?.scrollTo(0, 0);
  }, [fileGridRef, resetKey]);

  useEffect(() => {
    onVisibleCountChange?.(incrementalEntries.renderedCount, incrementalEntries.totalCount);
  }, [incrementalEntries.renderedCount, incrementalEntries.totalCount, onVisibleCountChange]);

  return (
    <section
      className={`${styles.fileList}${draggingUpload ? ` ${styles.dragOver}` : ''}`}
      ref={fileGridRef as RefObject<HTMLDivElement>}
      onClick={fileClick}
      onContextMenu={onEmptyContextMenu}
      onDragLeave={onFileAreaDragLeave}
      onDragOver={onFileAreaDragOver}
      onDrop={onFileAreaDrop}
      onMouseDown={onFileAreaMouseDown}
      onKeyDown={onFileAreaKeyDown}
      onScroll={incrementalEntries.handleScroll}
      tabIndex={0}
    >
      {incrementalEntries.visibleEntries.map((entry) => (
        <FileItem
          key={entry.path}
          entry={entry}
          viewMode="list"
          isSelected={selectedPathSet.has(entry.path)}
          isDragOver={dragOverPath === entry.path}
          canWrite={canWrite}
          isFavorited={favoritePathSet.has(entry.path)}
          renameState={renameState}
          renameInputRef={renameInputRef}
          onContextMenu={(event) => onContextMenu(entry, event)}
          onClick={() => handleFileClick(entry, renameState, onNavigate, onPreview)}
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
      {incrementalEntries.hasMore && (
        <div key={incrementalEntries.renderedCount} ref={incrementalEntries.loadMoreSentinelRef} className={styles.loadMoreStatus} aria-live="polite">
          {incrementalEntries.loadingMore ? 'Loading more...' : 'Scroll to load more'}
        </div>
      )}
      {rubberBandStyle && <div className={styles.rubberBand} style={rubberBandStyle} />}
    </section>
  );
}
