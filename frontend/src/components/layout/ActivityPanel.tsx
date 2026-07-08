import { type Job } from '../../api/client';
import { Icon } from '../ui/Icon';
import styles from './ActivityPanel.module.css';

export type ActivityPanelProps = {
  jobs: Job[];
  onOpenJobs: () => void;
};

const RECENT_COUNT = 5;

function jobIcon(job: Job) {
  switch (job.type) {
    case 'copy':
      return 'edit-copy';
    case 'move':
      return 'document-open-recent';
    case 'upload':
      return 'document-import';
    case 'archive':
      return 'application-x-archive';
    case 'extract':
      return 'archive-extract';
    case 'checksum':
      return 'dialog-password';
    default:
      return 'emblem-system';
  }
}

type GroupedJobs = {
  active: Job[];
  recentCompleted: Job[];
  recentFailed: Job[];
};

function groupJobs(jobs: Job[]): GroupedJobs {
  const active: Job[] = [];
  const allCompleted: Job[] = [];
  const allFailed: Job[] = [];

  for (const job of jobs) {
    if (
      job.status === 'running' ||
      job.status === 'queued' ||
      job.status === 'paused' ||
      job.status === 'needs_attention'
    ) {
      active.push(job);
    } else if (job.status === 'completed') {
      allCompleted.push(job);
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      allFailed.push(job);
    }
  }

  allCompleted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  allFailed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    active,
    recentCompleted: allCompleted.slice(0, RECENT_COUNT),
    recentFailed: allFailed.slice(0, RECENT_COUNT),
  };
}

export function ActivityPanel({ jobs, onOpenJobs }: ActivityPanelProps) {
  const { active, recentCompleted, recentFailed } = groupJobs(jobs);

  const hasActivity = active.length > 0 || recentCompleted.length > 0 || recentFailed.length > 0;

  return (
    <div className={styles.panel}>
      {!hasActivity && <div className={styles.empty}>No recent activity</div>}

      {active.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Active</div>
          {active.map((job) => (
            <div key={job.id} className={styles.item}>
              <Icon name={jobIcon(job)} size={14} />
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {job.type === 'upload'
                    ? 'Upload'
                    : job.type === 'copy'
                      ? 'Copy'
                      : job.type === 'move'
                        ? 'Move'
                        : job.type === 'archive'
                          ? 'Archive'
                          : job.type === 'extract'
                            ? 'Extract'
                            : job.type === 'checksum'
                              ? 'Checksum'
                              : 'Transfer'}
                  {job.currentItem ? ` — ${job.currentItem}` : ''}
                </span>
                <span className={styles.itemStatus}>
                  {job.status === 'needs_attention' ? 'Needs attention' : job.status}
                </span>
              </div>
              {job.totalBytes > 0 && (
                <span className={styles.itemProgress}>
                  {Math.round((job.processedBytes / job.totalBytes) * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {recentFailed.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Failed</div>
          {recentFailed.map((job) => (
            <div key={job.id} className={styles.item}>
              <Icon name={jobIcon(job)} size={14} />
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {job.type === 'upload'
                    ? 'Upload'
                    : job.type === 'copy'
                      ? 'Copy'
                      : job.type === 'move'
                        ? 'Move'
                        : job.type === 'archive'
                          ? 'Archive'
                          : job.type === 'extract'
                            ? 'Extract'
                            : job.type === 'checksum'
                              ? 'Checksum'
                              : 'Transfer'}
                  {job.currentItem ? ` — ${job.currentItem}` : ''}
                </span>
                {job.errorMessage && <span className={styles.itemError}>{job.errorMessage}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {recentCompleted.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Completed</div>
          {recentCompleted.map((job) => (
            <div key={job.id} className={styles.item}>
              <Icon name={jobIcon(job)} size={14} />
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {job.type === 'upload'
                    ? 'Upload'
                    : job.type === 'copy'
                      ? 'Copy'
                      : job.type === 'move'
                        ? 'Move'
                        : job.type === 'archive'
                          ? 'Archive'
                          : job.type === 'extract'
                            ? 'Extract'
                            : job.type === 'checksum'
                              ? 'Checksum'
                              : 'Transfer'}
                  {job.currentItem ? ` — ${job.currentItem}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasActivity && (
        <button type="button" className={styles.viewAll} onClick={onOpenJobs}>
          View all jobs &rarr;
        </button>
      )}
    </div>
  );
}
