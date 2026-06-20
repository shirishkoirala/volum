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
    let count = 0;
    const fetcher = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.data).toBe('data'));
    fetcher.mockResolvedValue('updated');
    result.current.refresh();
    await waitFor(() => expect(result.current.data).toBe('updated'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
