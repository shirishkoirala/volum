/**
 * Shared job-related predicates and helpers.
 */

import type { Job } from '../api/client-jobs';

export function makeJobLabel(type: string, action: string): string {
  const name =
    type === 'duplicate_find'
      ? 'Duplicate Finder'
      : type === 'disk_analyze'
        ? 'Disk Analyzer'
        : type.charAt(0).toUpperCase() + type.slice(1);
  return `${name} ${action}`.trim();
}

export function isActiveTransferJob(job: Job): boolean {
  return job.status === 'running' || job.status === 'queued' || job.status === 'paused';
}

export function countActiveTransfers(jobs: Job[]): number {
  return jobs.filter(isActiveTransferJob).length;
}

export function isAnalysisJob(job: Job): boolean {
  return job.type === 'disk_analyze' || job.type === 'duplicate_find';
}

/**
 * Returns true when completing this job type means the file list should refresh.
 */
export function refreshesFiles(job: Job): boolean {
  return (
    job.type === 'copy' ||
    job.type === 'move' ||
    job.type === 'upload' ||
    job.type === 'archive' ||
    job.type === 'extract' ||
    job.type === 'trash' ||
    job.type === 'restore'
  );
}
