import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAsyncData } from '../hooks/useAsyncData';

describe('useAsyncData', () => {
  it('loads data on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue('hello');
    const { result } = renderHook(() => useAsyncData(fetcher));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('hello'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('oops'));
    const { result } = renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.error).toBe('oops'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('re-fetches on refresh', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.data).toBe('data'));
    fetcher.mockResolvedValue('updated');
    result.current.refresh();
    await waitFor(() => expect(result.current.data).toBe('updated'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not refetch when an inline fetcher changes identity on render', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const { result, rerender } = renderHook(() => useAsyncData(() => fetcher()));

    await waitFor(() => expect(result.current.data).toBe('data'));
    rerender();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refresh uses the latest fetcher', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');
    let fetcher = first;
    const { result, rerender } = renderHook(() => useAsyncData(fetcher));

    await waitFor(() => expect(result.current.data).toBe('first'));
    fetcher = second;
    rerender();
    result.current.refresh();

    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
