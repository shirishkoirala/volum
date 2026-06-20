import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLongPress } from '../hooks/useLongPress';

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onLongPress after the delay', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onClick, onLongPress, delay: 500 }));
    result.current.onMouseDown({} as React.MouseEvent);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick on mouse up before the delay', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onClick, onLongPress, delay: 500 }));
    result.current.onMouseDown({} as React.MouseEvent);
    result.current.onMouseUp({} as React.MouseEvent);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('clears the timer on mouse leave', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));
    result.current.onTouchStart({} as React.TouchEvent);
    result.current.onMouseLeave({} as React.MouseEvent);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('calls onLongPress on touch start after delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));
    result.current.onTouchStart({} as React.TouchEvent);
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it('calls onClick on touch end before the delay', () => {
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onClick, onLongPress: vi.fn(), delay: 500 }));
    result.current.onTouchStart({} as React.TouchEvent);
    result.current.onTouchEnd({} as React.TouchEvent);
    vi.advanceTimersByTime(500);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
