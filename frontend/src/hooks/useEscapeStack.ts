import { useEffect } from 'react';

const stack: Array<() => void> = [];
let handler: ((e: KeyboardEvent) => void) | null = null;

function ensureHandler() {
  if (handler) return;
  handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && stack.length > 0) {
      const close = stack[stack.length - 1];
      close?.();
    }
  };
  window.addEventListener('keydown', handler);
}

function removeHandlerIfEmpty() {
  if (stack.length > 0 || !handler) return;
  window.removeEventListener('keydown', handler);
  handler = null;
}

export function useEscapeStack(onClose?: () => void) {
  useEffect(() => {
    if (!onClose) return;
    stack.push(onClose);
    ensureHandler();
    return () => {
      const idx = stack.indexOf(onClose);
      if (idx !== -1) stack.splice(idx, 1);
      removeHandlerIfEmpty();
    };
  }, [onClose]);
}
