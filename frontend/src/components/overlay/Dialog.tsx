import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';
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

const FOCUSABLE_SELECTOR = [
  '[autofocus]',
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'audio[controls]',
  'video[controls]',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Dialog({
  title,
  subtitle,
  hideHeader,
  width = 'md',
  zIndex = 500,
  onClose,
  children,
  footer,
}: DialogProps) {
  useEscapeStack(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialog.contains(document.activeElement)) {
      const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog).focus();
    }

    return () => {
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === dialog)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <Overlay zIndex={zIndex} onClose={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles[width]}${hideHeader ? ` ${styles.dialogNoPad}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {!hideHeader && <PanelHeader title={title ?? ''} subtitle={subtitle} onClose={onClose} />}
        {!hideHeader ? <div className={styles.dialogBody}>{children}</div> : children}
        {footer && <div className={styles.dialogFooter}>{footer}</div>}
      </div>
    </Overlay>
  );
}
