import { describe, it, expect } from 'vitest';
import { isActiveTransferJob, countActiveTransfers, refreshesFiles } from '../utils/jobs';
import type { Job } from '../api/client';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: '1',
  type: 'copy',
  sourcePath: '/src',
  destinationPath: '/dst',
  status: 'completed',
  totalBytes: 1000,
  processedBytes: 1000,
  totalItems: 1,
  processedItems: 1,
  conflictPolicy: 'ask',
  verifyMode: 'none',
  createdAt: '2026-06-10T10:00:00Z',
  updatedAt: '2026-06-10T10:01:00Z',
  ...overrides,
});

describe('isActiveTransferJob', () => {
  it('returns true for running', () => {
    expect(isActiveTransferJob(makeJob({ status: 'running' }))).toBe(true);
  });

  it('returns true for queued', () => {
    expect(isActiveTransferJob(makeJob({ status: 'queued' }))).toBe(true);
  });

  it('returns true for paused', () => {
    expect(isActiveTransferJob(makeJob({ status: 'paused' }))).toBe(true);
  });

  it('returns false for completed', () => {
    expect(isActiveTransferJob(makeJob({ status: 'completed' }))).toBe(false);
  });

  it('returns false for failed', () => {
    expect(isActiveTransferJob(makeJob({ status: 'failed' }))).toBe(false);
  });

  it('returns false for cancelled', () => {
    expect(isActiveTransferJob(makeJob({ status: 'cancelled' }))).toBe(false);
  });
});

describe('countActiveTransfers', () => {
  it('counts running jobs', () => {
    expect(countActiveTransfers([makeJob({ status: 'running' })])).toBe(1);
  });

  it('counts multiple active jobs', () => {
    const jobs = [
      makeJob({ status: 'running' }),
      makeJob({ id: '2', status: 'queued' }),
      makeJob({ id: '3', status: 'completed' }),
    ];
    expect(countActiveTransfers(jobs)).toBe(2);
  });

  it('adds pendingTransferCount', () => {
    expect(countActiveTransfers([makeJob({ status: 'running' })], 3)).toBe(4);
  });

  it('returns 0 for no active jobs and no pending', () => {
    expect(countActiveTransfers([makeJob({ status: 'completed' })])).toBe(0);
  });
});

describe('refreshesFiles', () => {
  it('returns true for copy', () => {
    expect(refreshesFiles(makeJob({ type: 'copy' }))).toBe(true);
  });

  it('returns true for move', () => {
    expect(refreshesFiles(makeJob({ type: 'move' }))).toBe(true);
  });

  it('returns true for upload', () => {
    expect(refreshesFiles(makeJob({ type: 'upload' }))).toBe(true);
  });

  it('returns true for archive', () => {
    expect(refreshesFiles(makeJob({ type: 'archive' }))).toBe(true);
  });

  it('returns true for extract', () => {
    expect(refreshesFiles(makeJob({ type: 'extract' }))).toBe(true);
  });

  it('returns false for checksum', () => {
    expect(refreshesFiles(makeJob({ type: 'checksum' }))).toBe(false);
  });
});
