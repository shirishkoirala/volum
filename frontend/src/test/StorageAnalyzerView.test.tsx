import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageAnalyzerView } from '../pages/StorageAnalyzerView';
import type { Job } from '../api/client';

const api = vi.hoisted(() => ({
  cancelJob: vi.fn(),
  createJob: vi.fn(),
  deletePath: vi.fn(),
  getDiskUsageResults: vi.fn(),
  getDiskUsageSummary: vi.fn(),
  getDuplicateResults: vi.fn(),
  getDuplicateSummary: vi.fn(),
}));

vi.mock('../api/client', () => api);

const scanJob = {
  id: 'scan-1',
  type: 'duplicate_find',
  status: 'completed',
  totalBytes: 20,
  processedBytes: 20,
  totalItems: 2,
  processedItems: 2,
  conflictPolicy: 'ask',
  verifyMode: 'size',
  createdAt: '',
  updatedAt: '',
} satisfies Job;

const trashJob = {
  ...scanJob,
  id: 'trash-1',
  type: 'trash',
  status: 'queued',
} satisfies Job;

describe('StorageAnalyzerView duplicate cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.createJob.mockResolvedValue({ ...scanJob, status: 'queued' });
    api.deletePath.mockResolvedValue(trashJob);
    api.getDuplicateResults.mockResolvedValue({
      results: [
        { groupId: 1, path: '/storage/a.txt', sizeBytes: 10, checksum: 'same' },
        { groupId: 1, path: '/storage/b.txt', sizeBytes: 10, checksum: 'same' },
      ],
      total: 2,
    });
    api.getDuplicateSummary.mockResolvedValue({
      jobId: scanJob.id,
      groupCount: 1,
      fileCount: 2,
      reclaimableBytes: 10,
      skippedCount: 0,
    });
  });

  it('keeps a duplicate visible until its trash job completes', async () => {
    const user = userEvent.setup();
    const roots = [
      {
        path: '/storage',
        discovered: false,
        available: true,
        totalBytes: 100,
        freeBytes: 50,
        usedBytes: 50,
        isHome: false,
      },
    ];
    const { rerender } = render(
      <StorageAnalyzerView roots={roots} jobs={[]} preselectedSection="duplicates" />,
    );

    await user.click(screen.getByText('Scan'));
    await waitFor(() => expect(api.createJob).toHaveBeenCalled());
    rerender(
      <StorageAnalyzerView roots={roots} jobs={[scanJob]} preselectedSection="duplicates" />,
    );
    await user.click(await screen.findByLabelText('Select /storage/a.txt'));
    await user.click(screen.getByText('Trash selected'));
    await user.click(screen.getByText('Move to Trash'));

    expect(await screen.findByText('Moving to Trash...')).toBeInTheDocument();
    expect(screen.getByText('a.txt')).toBeInTheDocument();

    rerender(
      <StorageAnalyzerView
        roots={roots}
        jobs={[scanJob, trashJob]}
        preselectedSection="duplicates"
      />,
    );
    expect(screen.getByText('a.txt')).toBeInTheDocument();

    rerender(
      <StorageAnalyzerView
        roots={roots}
        jobs={[scanJob, { ...trashJob, status: 'completed' }]}
        preselectedSection="duplicates"
      />,
    );
    await waitFor(() => expect(screen.queryByText('a.txt')).not.toBeInTheDocument());
    expect(screen.getByText('b.txt')).toBeInTheDocument();
  });
});
