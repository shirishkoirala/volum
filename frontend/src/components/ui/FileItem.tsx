import { DragEvent, RefObject, useEffect, useRef, useState } from 'react';
import { Icon, FileIcon, FolderIcon } from './Icon';
import { rawUrl } from '../../api/client';
import { canThumbnail } from '../../utils/preview';
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

function FileThumbnail({
  entry,
  className,
  size,
}: {
  entry: FileEntry;
  className?: string;
  size: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSrc(null);
    setFailed(false);

    const frame = frameRef.current;
    if (!frame) return;

    let objectUrl: string | null = null;
    let observer: IntersectionObserver | null = null;
    let controller: AbortController | null = null;
    let cancelled = false;

    const load = () => {
      controller = new AbortController();
      fetch(rawUrl(entry.path), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Failed to load preview (${response.status})`);
          return response.blob();
        })
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        })
        .catch((error: Error) => {
          if (!cancelled && error.name !== 'AbortError') setFailed(true);
        });
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (observedEntries) => {
          if (!observedEntries.some((observed) => observed.isIntersecting)) return;
          observer?.disconnect();
          load();
        },
        { rootMargin: '160px' },
      );
      observer.observe(frame);
    } else {
      load();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      controller?.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.path]);

  if (failed) return <FileIcon entry={entry} size={size} />;

  return (
    <div
      ref={frameRef}
      className={`${styles.fileThumbFrame}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          className={styles.fileThumbImage}
          src={src}
          alt={entry.name}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <FileIcon entry={entry} size={32} />
      )}
    </div>
  );
}

export function FileItem({
  entry,
  viewMode,
  isSelected,
  isDragOver,
  canWrite,
  isFavorited,
  renameState,
  renameInputRef,
  onContextMenu,
  onClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onCommitRename,
  onCancelRename,
  onRenameChange,
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
      ) : canThumbnail(entry) ? (
        <FileThumbnail
          entry={entry}
          className={viewMode === 'grid' ? styles.fileThumbFrame : undefined}
          size={fileIconSize}
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
