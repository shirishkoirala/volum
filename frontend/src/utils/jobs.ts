/**
 * Shared job-related predicates.
 */

import type { Job } from '../api/client';

/**
 * Returns true when completing this job type means the file list should refresh.
 */
export function refreshesFiles(job: Job): boolean {
  return job.type === 'copy' || job.type === 'move' || job.type === 'upload' || job.type === 'archive' || job.type === 'extract';
}
