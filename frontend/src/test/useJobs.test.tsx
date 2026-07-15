import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useJobs } from '../hooks/useJobs';
import * as api from '../api/client';
import { buildJob, buildSession } from './fixtures';

vi.mock('../api/client', () => ({
  getJobs: vi.fn(),
  cancelJob: vi.fn(),
  retryJob: vi.fn(),
  retryJobItem: vi.fn(),
  pauseJob: vi.fn(),
  resumeJob: vi.fn(),
  clearCompletedJobs: vi.fn(),
  clearFailedJobs: vi.fn(),
}));

function mockEventSource() {
  const listeners: Record<string, ((event: { data: string }) => void)[]> = {};
  const es = {
    addEventListener: vi.fn((event: string, handler: (event: { data: string }) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    close: vi.fn(),
    onerror: null,
    dispatchEvent: (event: string, data: string) => {
      listeners[event]?.forEach((h) => h({ data }));
    },
  };
  if (typeof globalThis.EventSource === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).EventSource = vi.fn();
  }
  vi.spyOn(globalThis, 'EventSource').mockImplementation(() => es as unknown as EventSource);
  return es;
}

const fakeSession = buildSession();

beforeEach(() => {
  vi.clearAllMocks();
  (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useJobs', () => {
  it('fetches jobs on mount', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();

    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [buildJob({ id: '1' })] });

    renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(api.getJobs).toHaveBeenCalledTimes(1);
      expect(setJobs).toHaveBeenCalledWith([expect.objectContaining({ id: '1' })]);
    });
  });

  it('skips fetch when sessionLoading', () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();

    renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: true,
        onRefresh,
        showToast,
      }),
    );

    expect(api.getJobs).not.toHaveBeenCalled();
  });

  it('skips fetch when not authenticated', () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();

    renderHook(() =>
      useJobs(setJobs, {
        session: { authEnabled: true, authenticated: false },
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    expect(api.getJobs).not.toHaveBeenCalled();
  });

  it('handleCancelJob calls cancelJob and refreshes', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.cancelJob as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handleCancelJob('1');

    await waitFor(() => {
      expect(api.cancelJob).toHaveBeenCalledWith('1');
      expect(showToast).toHaveBeenCalledWith('Transfer cancelled', 'success');
    });
  });

  it('handleRetryJob calls retryJob and refreshes', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.retryJob as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handleRetryJob('1');

    await waitFor(() => {
      expect(api.retryJob).toHaveBeenCalledWith('1');
      expect(showToast).toHaveBeenCalledWith('Transfer retried', 'success');
    });
  });

  it('handlePauseJob calls pauseJob and refreshes', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.pauseJob as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handlePauseJob('1');

    await waitFor(() => {
      expect(api.pauseJob).toHaveBeenCalledWith('1');
      expect(showToast).toHaveBeenCalledWith('Transfer paused', 'success');
    });
  });

  it('handleResumeJob calls resumeJob and refreshes', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.resumeJob as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handleResumeJob('1');

    await waitFor(() => {
      expect(api.resumeJob).toHaveBeenCalledWith('1');
      expect(showToast).toHaveBeenCalledWith('Transfer resumed', 'success');
    });
  });

  it('handleClearCompleted calls clearCompletedJobs', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.clearCompletedJobs as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handleClearCompleted();

    await waitFor(() => {
      expect(api.clearCompletedJobs).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Completed transfers cleared', 'success');
    });
  });

  it('handleClearFailed calls clearFailedJobs', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.clearFailedJobs as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handleClearFailed();

    await waitFor(() => {
      expect(api.clearFailedJobs).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Failed transfers cleared', 'success');
    });
  });

  it('showToast with error message on action failure', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    mockEventSource();
    (api.cancelJob as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('server error'));
    (api.getJobs as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    result.current.handleCancelJob('1');

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Action failed', 'error', 'server error');
    });
  });

  it('SSE jobs event with completed file-transfer job triggers refresh', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    const es = mockEventSource();

    renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    es.dispatchEvent(
      'jobs',
      JSON.stringify({ jobs: [buildJob({ id: '2', status: 'completed', type: 'copy' })] }),
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('SSE jobs event with non-file-transfer job does not trigger refresh', async () => {
    const setJobs = vi.fn();
    const onRefresh = vi.fn();
    const showToast = vi.fn();
    const es = mockEventSource();

    renderHook(() =>
      useJobs(setJobs, {
        session: fakeSession,
        sessionLoading: false,
        onRefresh,
        showToast,
      }),
    );

    await waitFor(() => expect(api.getJobs).toHaveBeenCalled());

    es.dispatchEvent(
      'jobs',
      JSON.stringify({ jobs: [buildJob({ id: '2', status: 'completed', type: 'checksum' })] }),
    );

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
