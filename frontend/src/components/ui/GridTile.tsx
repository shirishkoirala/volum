import type { HTMLAttributes, ReactNode } from 'react';
import styles from './GridTile.module.css';

export const GRID_ICON_SIZE = 84;
export const LIST_ICON_SIZE = 28;

type GridTileProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  icon: ReactNode;
  name: ReactNode;
  metadata?: ReactNode;
  isSelected: boolean;
};

export function GridTile({
  icon,
  name,
  metadata,
  isSelected,
  className,
  ...divProps
}: GridTileProps) {
  return (
    <div
      {...divProps}
      className={`${styles.tile}${isSelected ? ` ${styles.selected}` : ''}${className ? ` ${className}` : ''}`}
    >
      <div className={styles.iconSlot}>{icon}</div>
      <span className={styles.name} title={typeof name === 'string' ? name : undefined}>
        {name}
      </span>
      {metadata && <span className={styles.meta}>{metadata}</span>}
    </div>
  );
}
