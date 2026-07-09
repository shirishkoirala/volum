import { describe, it, expect } from 'vitest';
import { isActiveTransferJob, countActiveTransfers, refreshesFiles } from '../utils/jobs';
import { buildJob } from './fixtures';

describe('isActiveTransferJob', () => {
  it('returns true for running', () => {
    expect(isActiveTransferJob(buildJob({ status: 'running' }))).toBe(true);
  });

  it('returns true for queued', () => {
    expect(isActiveTransferJob(buildJob({ status: 'queued' }))).toBe(true);
  });

  it('returns true for paused', () => {
    expect(isActiveTransferJob(buildJob({ status: 'paused' }))).toBe(true);
  });

  it('returns false for completed', () => {
    expect(isActiveTransferJob(buildJob({ status: 'completed' }))).toBe(false);
  });

  it('returns false for failed', () => {
    expect(isActiveTransferJob(buildJob({ status: 'failed' }))).toBe(false);
  });

  it('returns false for cancelled', () => {
    expect(isActiveTransferJob(buildJob({ status: 'cancelled' }))).toBe(false);
  });
});

describe('countActiveTransfers', () => {
  it('counts running jobs', () => {
    expect(countActiveTransfers([buildJob({ status: 'running' })])).toBe(1);
  });

  it('counts multiple active jobs', () => {
    const jobs = [
      buildJob({ status: 'running' }),
      buildJob({ id: '2', status: 'queued' }),
      buildJob({ id: '3', status: 'completed' }),
    ];
    expect(countActiveTransfers(jobs)).toBe(2);
  });

  it('adds pendingTransferCount', () => {
    expect(countActiveTransfers([buildJob({ status: 'running' })], 3)).toBe(4);
  });

  it('returns 0 for no active jobs and no pending', () => {
    expect(countActiveTransfers([buildJob({ status: 'completed' })])).toBe(0);
  });
});

describe('refreshesFiles', () => {
  it('returns true for copy', () => {
    expect(refreshesFiles(buildJob({ type: 'copy' }))).toBe(true);
  });

  it('returns true for move', () => {
    expect(refreshesFiles(buildJob({ type: 'move' }))).toBe(true);
  });

  it('returns true for upload', () => {
    expect(refreshesFiles(buildJob({ type: 'upload' }))).toBe(true);
  });

  it('returns true for archive', () => {
    expect(refreshesFiles(buildJob({ type: 'archive' }))).toBe(true);
  });

  it('returns true for extract', () => {
    expect(refreshesFiles(buildJob({ type: 'extract' }))).toBe(true);
  });

  it('returns false for checksum', () => {
    expect(refreshesFiles(buildJob({ type: 'checksum' }))).toBe(false);
  });
});
