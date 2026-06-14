import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useIncrementalEntries } from '../hooks/useIncrementalEntries';

describe('useIncrementalEntries', () => {
  it('returns all entries for normal folders', () => {
    const entries = Array.from({ length: 20 }, (_, index) => index);
    const { result } = renderHook(() => useIncrementalEntries(entries));

    expect(result.current.incremental).toBe(false);
    expect(result.current.renderedCount).toBe(20);
    expect(result.current.visibleEntries).toHaveLength(20);
    expect(result.current.hasMore).toBe(false);
  });

  it('caps initial render for large folders and loads more on demand', () => {
    const entries = Array.from({ length: 900 }, (_, index) => index);
    const { result } = renderHook(() => useIncrementalEntries(entries));

    expect(result.current.incremental).toBe(true);
    expect(result.current.renderedCount).toBe(240);
    expect(result.current.visibleEntries).toHaveLength(240);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    expect(result.current.renderedCount).toBe(480);
    expect(result.current.visibleEntries).toHaveLength(480);
  });

  it('resets the visible count when entries change', () => {
    const largeEntries = Array.from({ length: 900 }, (_, index) => index);
    const smallerEntries = Array.from({ length: 40 }, (_, index) => index);
    const { result, rerender } = renderHook(({ entries }) => useIncrementalEntries(entries), {
      initialProps: { entries: largeEntries },
    });

    act(() => result.current.loadMore());
    expect(result.current.renderedCount).toBe(480);

    rerender({ entries: smallerEntries });

    expect(result.current.incremental).toBe(false);
    expect(result.current.renderedCount).toBe(40);
    expect(result.current.visibleEntries).toHaveLength(40);
  });

  it('calls remote load when all loaded entries are visible but total has more', () => {
    const entries = Array.from({ length: 600 }, (_, index) => index);
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useIncrementalEntries(entries, {
      totalCount: 720,
      onLoadMore,
    }));

    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());

    expect(result.current.renderedCount).toBe(600);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps progress when a remote page is appended', () => {
    const firstPage = Array.from({ length: 600 }, (_, index) => index);
    const secondPage = Array.from({ length: 720 }, (_, index) => index);
    const { result, rerender } = renderHook(({ entries }) => useIncrementalEntries(entries, {
      totalCount: 720,
      resetKey: '/folder:false::grid',
    }), {
      initialProps: { entries: firstPage },
    });

    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    expect(result.current.renderedCount).toBe(600);

    rerender({ entries: secondPage });

    expect(result.current.renderedCount).toBe(720);
    expect(result.current.hasMore).toBe(false);
  });
});
