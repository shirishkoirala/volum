import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageAnalyzerView } from '../pages/StorageAnalyzerView';
import type { Job } from '../api/client-jobs';

const api = vi.hoisted(() => ({
  cancelJob: vi.fn(),
  createJob: vi.fn(),
  deletePath: vi.fn(),
  getDiskUsageResults: vi.fn(),
  getDiskUsageSummary: vi.fn(),
  getDuplicateResults: vi.fn(),
  getDuplicateSummary: vi.fn(),
}));

vi.mock('../api/client-files', () => ({
  deletePath: api.deletePath,
  getDiskUsageResults: api.getDiskUsageResults,
  getDiskUsageSummary: api.getDiskUsageSummary,
  getDuplicateResults: api.getDuplicateResults,
  getDuplicateSummary: api.getDuplicateSummary,
}));
vi.mock('../api/client-jobs', () => ({
  cancelJob: api.cancelJob,
  createJob: api.createJob,
}));

const scanJob = {
  id: 'scan-1',
  type: 'duplicate_find',
  sourcePath: '/storage',
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

const diskJob = {
  ...scanJob,
  id: 'disk-1',
  type: 'disk_analyze',
  sourcePath: '/storage',
  createdAt: '2026-07-28T10:00:00Z',
  updatedAt: '2026-07-28T10:30:00Z',
} satisfies Job;

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
    api.getDiskUsageSummary.mockResolvedValue({
      jobId: diskJob.id,
      totalBytes: 20,
      fileCount: 2,
      directoryCount: 0,
      skippedCount: 0,
    });
    api.getDiskUsageResults.mockResolvedValue({ results: [], total: 0 });
  });

  it('keeps a duplicate visible until its trash job completes', async () => {
    const user = userEvent.setup();
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

  it('reopens persisted disk results from recent analyses', async () => {
    const user = userEvent.setup();
    render(<StorageAnalyzerView roots={roots} jobs={[diskJob]} />);

    await user.click(screen.getByRole('button', { name: /storage.*View results/i }));

    await waitFor(() => {
      expect(api.getDiskUsageSummary).toHaveBeenCalledWith(diskJob.id);
      expect(api.getDiskUsageResults).toHaveBeenCalledWith(diskJob.id, '/storage', 500, 0);
    });
    expect(await screen.findByText('Scanned folder')).toBeInTheDocument();
  });

  it('keeps reopened results visible when the job feed updates', async () => {
    const { rerender } = render(
      <StorageAnalyzerView roots={roots} jobs={[diskJob]} initialJobId={diskJob.id} />,
    );

    expect(await screen.findByText('Scanned folder')).toBeInTheDocument();

    rerender(
      <StorageAnalyzerView
        roots={roots}
        jobs={[{ ...diskJob, updatedAt: '2026-07-28T10:31:00Z' }]}
        initialJobId={diskJob.id}
      />,
    );

    expect(screen.getByText('Scanned folder')).toBeInTheDocument();
  });

  it('loads every page of persisted disk results', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      jobId: diskJob.id,
      path: `/storage/folder-${index}`,
      parentPath: '/storage',
      name: `folder-${index}`,
      isDir: true,
      sizeBytes: 1,
      fileCount: 0,
      dirCount: 0,
    }));
    const lastResult = {
      jobId: diskJob.id,
      path: '/storage/folder-500',
      parentPath: '/storage',
      name: 'folder-500',
      isDir: true,
      sizeBytes: 1,
      fileCount: 0,
      dirCount: 0,
    };
    api.getDiskUsageResults.mockImplementation(
      (_jobId: string, _parentPath: string, _limit: number, offset: number) =>
        Promise.resolve({
          results: offset === 0 ? firstPage : [lastResult],
          total: 501,
        }),
    );

    render(<StorageAnalyzerView roots={roots} jobs={[diskJob]} initialJobId={diskJob.id} />);

    expect(await screen.findByText('folder-500')).toBeInTheDocument();
    expect(api.getDiskUsageResults).toHaveBeenNthCalledWith(1, diskJob.id, '/storage', 500, 0);
    expect(api.getDiskUsageResults).toHaveBeenNthCalledWith(2, diskJob.id, '/storage', 500, 500);
  });

  it('loads every page of persisted duplicate results', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      jobId: scanJob.id,
      groupId: Math.floor(index / 2),
      path: `/storage/duplicate-${index}.txt`,
      sizeBytes: 10,
      checksum: `checksum-${Math.floor(index / 2)}`,
    }));
    const lastResult = {
      jobId: scanJob.id,
      groupId: 250,
      path: '/storage/duplicate-500.txt',
      sizeBytes: 10,
      checksum: 'checksum-250',
    };
    api.getDuplicateResults.mockImplementation((_jobId: string, _limit: number, offset: number) =>
      Promise.resolve({
        results: offset === 0 ? firstPage : [lastResult],
        total: 501,
      }),
    );

    render(
      <StorageAnalyzerView
        roots={roots}
        jobs={[scanJob]}
        preselectedSection="duplicates"
        initialJobId={scanJob.id}
      />,
    );

    expect(await screen.findByText('duplicate-500.txt')).toBeInTheDocument();
    expect(api.getDuplicateResults).toHaveBeenNthCalledWith(1, scanJob.id, 500, 0);
    expect(api.getDuplicateResults).toHaveBeenNthCalledWith(2, scanJob.id, 500, 500);
  });

  it('keeps disk rescan in a stable starting state and submits once', async () => {
    api.createJob.mockImplementation(() => new Promise(() => {}));
    render(<StorageAnalyzerView roots={roots} jobs={[diskJob]} initialJobId={diskJob.id} />);

    const rescan = await screen.findByRole('button', { name: 'Rescan' });
    fireEvent.click(rescan);
    fireEvent.click(rescan);

    expect(api.createJob).toHaveBeenCalledOnce();
    expect(await screen.findByText('Starting scan...')).toBeInTheDocument();
  });

  it('keeps duplicate rescan visible while its new job reaches the feed', async () => {
    const queuedJob = { ...scanJob, id: 'scan-2', status: 'queued' } satisfies Job;
    api.createJob.mockResolvedValue(queuedJob);
    const { rerender } = render(
      <StorageAnalyzerView
        roots={roots}
        jobs={[scanJob]}
        preselectedSection="duplicates"
        initialJobId={scanJob.id}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Rescan' }));

    expect(api.createJob).toHaveBeenCalledOnce();
    expect(await screen.findByText('Waiting for scan status...')).toBeInTheDocument();

    rerender(
      <StorageAnalyzerView
        roots={roots}
        jobs={[scanJob, queuedJob]}
        preselectedSection="duplicates"
        initialJobId={scanJob.id}
      />,
    );
    expect(await screen.findByText('Scanning for duplicates in /storage...')).toBeInTheDocument();
  });
});
