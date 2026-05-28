import { type ReactNode } from 'react';
import { Overlay, PanelHeader } from '../ui/shared';
import { useEscapeStack } from '../../hooks/useEscapeStack';
import styles from './Dialog.module.css';

type DialogProps = {
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  zIndex?: number;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ title, subtitle, hideHeader, width = 'md', zIndex = 110, onClose, children, footer }: DialogProps) {
  useEscapeStack(onClose);

  return (
    <Overlay zIndex={zIndex} onClose={onClose}>
      <div className={`${styles.dialog} ${styles[width]}${hideHeader ? ` ${styles.dialogNoPad}` : ''}`} role="dialog" aria-modal="true" aria-label={hideHeader ? undefined : title}>
        {!hideHeader && <PanelHeader title={title ?? ''} subtitle={subtitle} onClose={onClose} />}
        {!hideHeader ? (
          <div className={styles.dialogBody}>{children}</div>
        ) : (
          children
        )}
        {footer && <div className={styles.dialogFooter}>{footer}</div>}
      </div>
    </Overlay>
  );
}
