import { DragEvent, RefObject } from 'react';
import { Icon, FileIcon, FolderIcon } from './Icon';
import { rawUrl } from '../../api/client';
import { isImageExtension } from '../../utils/fileTypes';
import type { FileEntry } from '../../api/client';
import { formatBytes, formatGridDate } from '../../utils/format';
import type { RenameState } from '../../types';
import { GRID_ICON_SIZE, LIST_ICON_SIZE } from './GridTile';
import styles from './FileItem.module.css';

type FileItemProps = {
  entry: FileEntry;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  isDragOver: boolean;
  canWrite: boolean;
  isFavorited: boolean;
  renameState: RenameState | null;
  renameInputRef?: RefObject<HTMLInputElement | null>;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onClick: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onTouchStart?: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchMove?: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLElement>) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onRenameChange: (value: string) => void;
  className?: string;
};

export function FileItem({
  entry, viewMode, isSelected, isDragOver, canWrite, isFavorited,
  renameState, renameInputRef,
  onContextMenu, onClick,
  onDragStart, onDragOver, onDragLeave, onDrop,
  onTouchStart, onTouchMove, onTouchEnd,
  onCommitRename, onCancelRename, onRenameChange,
  className,
}: FileItemProps) {
  const fileIconSize = viewMode === 'grid' ? GRID_ICON_SIZE : LIST_ICON_SIZE;
  const rowClass = viewMode === 'grid' ? styles.fileRowGrid : styles.fileRowList;

  return (
    <div
      className={`${rowClass}${isSelected ? ` ${styles.selected}` : ''}${isDragOver ? ` ${styles.dragOver}` : ''}${className ? ` ${className}` : ''}`}
      draggable={canWrite}
      onDragStart={(event) => onDragStart(event)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => {
        if (renameState) return;
        onClick();
      }}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="button"
    >
      {entry.type === 'directory' ? (
        <span className={styles.iconWrap} onContextMenu={(e) => e.preventDefault()}>
          <FolderIcon size={fileIconSize} />
          {isFavorited && (
            <span className={styles.pinBadge}>
              <Icon name="bookmark-new" size={10} />
            </span>
          )}
        </span>
      ) : isImageExtension(entry.name.toLowerCase()) ? (
        <img
          className={viewMode === 'grid' ? styles.fileThumb : undefined}
          src={rawUrl(entry.path)}
          alt={entry.name}
          loading="lazy"
        />
      ) : (
        <FileIcon entry={entry} size={fileIconSize} />
      )}
      {renameState?.path === entry.path ? (
        <input
          ref={renameInputRef as RefObject<HTMLInputElement>}
          className={styles.renameInput}
          value={renameState.value}
          onBlur={() => onCommitRename()}
          onChange={(event) => onRenameChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommitRename();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelRename();
            }
          }}
        />
      ) : (
        <span className={styles.fileName}>{entry.name}</span>
      )}
      {viewMode === 'grid' && (
        <span className={styles.fileMeta}>
          {formatBytes(entry.size)}
          <span>{formatGridDate(entry.modifiedAt)}</span>
        </span>
      )}
      {viewMode === 'list' && (
        <>
          <span className={styles.listType}>{entry.type}</span>
          <span className={styles.listSize}>{formatBytes(entry.size)}</span>
          <span className={styles.listModified}>{new Date(entry.modifiedAt).toLocaleString()}</span>
          <span className={styles.listPermissions}>{entry.permissions}</span>
          <span className={styles.listOwner}>{entry.owner}</span>
          <span className={styles.listGroup}>{entry.group}</span>
        </>
      )}
    </div>
  );
}
