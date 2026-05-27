import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './shared.module.css';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type OverlayProps = {
  children: ReactNode;
  zIndex?: number;
  onClose?: () => void;
};

export function Overlay({ children, zIndex = 100, onClose }: OverlayProps) {
  return (
    <div
      className={styles.overlay}
      style={{ zIndex }}
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}

type PanelHeaderProps = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children?: ReactNode;
};

export function PanelHeader({ title, subtitle, onClose, children }: PanelHeaderProps) {
  return (
    <div className={styles.panelHeader}>
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className={styles.panelHeaderActions}>
        {children}
        {onClose && (
          <IconButton onClick={onClose} aria-label="Close">
            <Icon name="window-close" size={18} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'secondary' | 'primary' | 'danger' | 'link';
  size?: 'default' | 'compact';
};

export function Button({ variant = 'secondary', size = 'default', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'danger' && styles.danger,
        variant === 'link' && styles.linkButton,
        size === 'compact' && styles.compact,
        className,
      )}
      type={type}
      {...props}
    />
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  danger?: boolean;
};

export function IconButton({ active = false, danger = false, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      className={cx(styles.iconButton, active && styles.iconButtonActive, danger && styles.iconButtonDanger, className)}
      type={type}
      {...props}
    />
  );
}

export function Notice({ variant, className, children }: { variant: 'error' | 'warning'; className?: string; children: ReactNode }) {
  return (
    <div className={cx(styles.notice, variant === 'error' ? styles.error : styles.warning, className)}>
      {children}
    </div>
  );
}

export function StatusBadge({ variant, children }: { variant: 'active' | 'disabled' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return (
    <span className={cx(styles.statusBadge, styles[variant])}>
      {children}
    </span>
  );
}

export function RotatedIcon({ quarterTurns = 2, children }: { quarterTurns?: 1 | 2 | 3; children: ReactNode }) {
  return (
    <span className={quarterTurns === 1 ? styles.iconRotate90 : quarterTurns === 3 ? styles.iconRotate270 : styles.iconRotate180}>
      {children}
    </span>
  );
}

export function MutedText({ compact = false, className, children }: { compact?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cx(styles.muted, compact && styles.mutedCompact, className)}>
      {children}
    </span>
  );
}

export function IconImg({ src, alt = '', width, height, className = '' }: { src: string; alt?: string; width: number; height: number; className?: string }) {
  return (
    <img src={src} alt={alt} width={width} height={height} className={`${styles.iconImg} ${className}`} />
  );
}
