import styles from './Skeleton.module.css';

type SkeletonProps = {
  variant: 'card' | 'row' | 'block' | 'line';
  width?: string;
  height?: string;
  count?: number;
};

export function Skeleton({ variant, width, height, count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count });
  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={`${styles.skeleton} ${styles[variant]}`}
          style={{ width, height }}
        />
      ))}
    </>
  );
}
