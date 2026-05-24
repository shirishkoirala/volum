import type { ReactNode, SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  title?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'children'>;

export function Select({ value, onChange, children, className, ariaLabel, title, ...rest }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.select}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      {...rest}
    >
      {children}
    </select>
  );
}
