import { useRef, useCallback } from 'react';

type LongPressOptions = {
  onClick?: () => void;
  onLongPress: () => void;
  delay?: number;
};

export function useLongPress({ onClick, onLongPress, delay = 500 }: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onMouseDown = useCallback(() => {
    timerRef.current = setTimeout(onLongPress, delay);
  }, [onLongPress, delay]);

  const onMouseUp = useCallback(() => {
    clear();
    if (onClick) onClick();
  }, [clear, onClick]);

  const onMouseLeave = useCallback(() => {
    clear();
  }, [clear]);

  const onTouchStart = useCallback(() => {
    timerRef.current = setTimeout(onLongPress, delay);
  }, [onLongPress, delay]);

  const onTouchEnd = useCallback(() => {
    clear();
    if (onClick) onClick();
  }, [clear, onClick]);

  return {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
  };
}
