import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode, TouchEvent } from 'react';
import styles from './GridTile.module.css';

export const GRID_ICON_SIZE = 84;
export const LIST_ICON_SIZE = 28;

type GridTileProps = {
  icon: ReactNode;
  name: ReactNode;
  metadata?: ReactNode;
  isSelected: boolean;
  isDragOver: boolean;
  className?: string;
  draggable?: boolean;
  role?: string;
  tabIndex?: number;
  'data-trash-id'?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onTouchStart?: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove?: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLElement>) => void;
};

export function GridTile({
  icon,
  name,
  metadata,
  isSelected,
  isDragOver,
  className,
  draggable = false,
  role = 'button',
  tabIndex,
  onClick,
  onDoubleClick,
  onContextMenu,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  ...dataAttrs
}: GridTileProps) {
  return (
    <div
      className={`${styles.tile}${isSelected ? ` ${styles.selected}` : ''}${isDragOver ? ` ${styles.dragOver}` : ''}${className ? ` ${className}` : ''}`}
      draggable={draggable}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      {...dataAttrs}
    >
      <div className={styles.iconSlot}>{icon}</div>
      <span className={styles.name} title={typeof name === 'string' ? name : undefined}>
        {name}
      </span>
      {metadata && <span className={styles.meta}>{metadata}</span>}
    </div>
  );
}
