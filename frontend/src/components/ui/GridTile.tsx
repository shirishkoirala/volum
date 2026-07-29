import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import styles from './GridTile.module.css';

export const GRID_ICON_SIZE = 84;
export const LIST_ICON_SIZE = 28;

type GridTileProps = {
  icon: ReactNode;
  name: ReactNode;
  metadata?: ReactNode;
  isSelected: boolean;
  className?: string;
  role?: string;
  tabIndex?: number;
  'data-trash-id'?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

export function GridTile({
  icon,
  name,
  metadata,
  isSelected,
  className,
  role = 'button',
  tabIndex,
  onClick,
  onContextMenu,
  onKeyDown,
  ...dataAttrs
}: GridTileProps) {
  return (
    <div
      className={`${styles.tile}${isSelected ? ` ${styles.selected}` : ''}${className ? ` ${className}` : ''}`}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
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
