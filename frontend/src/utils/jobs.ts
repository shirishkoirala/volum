/**
 * Shared job-related predicates.
 */

import type { Job } from '../api/client';

export function isActiveTransferJob(job: Job): boolean {
  return job.status === 'running' || job.status === 'queued' || job.status === 'paused';
}

export function countActiveTransfers(jobs: Job[], pendingTransferCount = 0): number {
  return jobs.filter(isActiveTransferJob).length + pendingTransferCount;
}

/**
 * Returns true when completing this job type means the file list should refresh.
 */
export function refreshesFiles(job: Job): boolean {
  return job.type === 'copy' || job.type === 'move' || job.type === 'upload' || job.type === 'archive' || job.type === 'extract';
}
