import type { ReactNode } from 'react';
import styles from './shared.module.css';

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
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="panel-header-actions">
        {children}
        {onClose && (
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.iconImg}>
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function IconImg({ src, alt = '', width, height, className = '' }: { src: string; alt?: string; width: number; height: number; className?: string }) {
  return (
    <img src={src} alt={alt} width={width} height={height} className={`${styles.iconImg} ${className}`} />
  );
}
