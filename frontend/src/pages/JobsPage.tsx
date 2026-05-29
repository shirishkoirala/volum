import type { Job } from '../api/client';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { jobsIconUrl } from '../api/icons';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button, StatusBadge } from '../components/ui/shared';
import { formatBytes } from '../utils/format';
import styles from './JobsPage.module.css';

const jobVariant = (status: string): 'success' | 'warning' | 'danger' | 'disabled' => {
  if (status === 'completed') return 'success';
  if (status === 'running' || status === 'paused') return 'warning';
  if (status === 'failed') return 'danger';
  return 'disabled';
};

function isActiveStatus(status: string) {
  return status === 'queued' || status === 'running' || status === 'paused';
}



function formatDuration(seconds: number) {
  if (seconds < 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(' ') || '< 1s';
}

function JobItem({
  job,
  onCancel,
  onPause,
  onResume,
  onRetry
}: {
  job: Job;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const progress = job.totalBytes > 0 ? Math.round((job.processedBytes / job.totalBytes) * 100) : 0;
  const canCancel = job.status === 'queued' || job.status === 'running' || job.status === 'paused';
  const canPause = job.status === 'running';
  const canResume = job.status === 'paused';
  const canRetry = job.status === 'failed' || job.status === 'cancelled';
  const showLiveStats = job.status === 'running';
  const hasKnownTotal = job.totalBytes > 0;

  return (
    <article className={styles.jobItem} role="listitem" tabIndex={0} data-job-id={job.id} onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}>
      <div className={styles.jobTitleRow}>
        <strong>{job.type}</strong>
        <StatusBadge variant={jobVariant(job.status)}>{job.status}</StatusBadge>
      </div>
      <ProgressBar value={progress} />
      <div className={styles.jobMeta}>
        <span>
          {hasKnownTotal
            ? `${formatBytes(job.processedBytes)} / ${formatBytes(job.totalBytes)}`
            : `${formatBytes(job.processedBytes)} uploaded`}
        </span>
        {showLiveStats && job.speedBytesPerSecond ? <span>{formatBytes(job.speedBytesPerSecond)}/s</span> : null}
        {showLiveStats && job.etaSeconds !== undefined ? <span>{formatDuration(job.etaSeconds)} left</span> : null}
      </div>
      <p>{job.currentItem ?? job.sourcePath ?? job.id}</p>
      {job.errorMessage && <p className={styles.jobError}>{job.errorMessage}</p>}
      {(canPause || canResume || canCancel || canRetry) && (
        <div className={styles.jobActions}>
          {canPause && (
            <Button size="compact" onClick={() => onPause(job.id)}>
              <Icon name="media-playback-pause" size={15} />
              Pause
            </Button>
          )}
          {canResume && (
            <Button size="compact" onClick={() => onResume(job.id)}>
              <Icon name="media-playback-start" size={15} />
              Resume
            </Button>
          )}
          {canCancel && (
            <Button size="compact" onClick={() => onCancel(job.id)}>
              <Icon name="process-stop" size={15} />
              Cancel
            </Button>
          )}
          {canRetry && (
            <Button size="compact" onClick={() => onRetry(job.id)}>
              <Icon name="view-refresh" size={15} />
              Retry
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function renderJobGroup(
  jobs: Job[],
  completedCollapsed: boolean,
  setCompletedCollapsed: (v: boolean) => void,
  onCancel: (id: string) => void,
  onPause: (id: string) => void,
  onResume: (id: string) => void,
  onRetry: (id: string) => void,
) {
  const terminal = ['completed', 'failed', 'cancelled'];
  const active = jobs.filter((j) => isActiveStatus(j.status));
  const terminalJobs = jobs.filter((j) => terminal.includes(j.status));

  return (
    <>
      {active.map((job) => (
        <JobItem key={job.id} job={job} onCancel={onCancel} onPause={onPause} onResume={onResume} onRetry={onRetry} />
      ))}
      {terminalJobs.length > 0 && (
        <>
          <button
            type="button"
            className={styles.jobCollapseToggle}
            onClick={() => setCompletedCollapsed(!completedCollapsed)}
          >
            {completedCollapsed ? `Show ${terminalJobs.length} completed` : 'Hide completed'}
          </button>
          {!completedCollapsed && terminalJobs.map((job) => (
            <JobItem key={job.id} job={job} onCancel={onCancel} onPause={onPause} onResume={onResume} onRetry={onRetry} />
          ))}
        </>
      )}
    </>
  );
}

type JobsPageProps = {
  jobs: Job[];
  completedCollapsed: boolean;
  setCompletedCollapsed: (v: boolean) => void;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
  onClearCompleted: () => void;
  onClearFailed: () => void;
  onJobsEmptyContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
};

function handleJobListKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = document.querySelectorAll<HTMLElement>('[data-job-id]');
    const current = document.activeElement;
    const idx = Array.from(items).indexOf(current as HTMLElement);
    const next = e.key === 'ArrowDown'
      ? Math.min(idx + 1, items.length - 1)
      : Math.max(idx - 1, 0);
    items[next]?.focus();
  }
}

export function JobsPage({
  jobs,
  completedCollapsed,
  setCompletedCollapsed,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onClearCompleted,
  onClearFailed,
  onJobsEmptyContextMenu,
}: JobsPageProps) {
  return (
    <>
      <main className={styles.jobsPage} onContextMenu={onJobsEmptyContextMenu}>
        <div className={styles.jobList} onKeyDown={handleJobListKeyDown} role="list">
      {jobs.length === 0 ? (
        <EmptyState icon={jobsIconUrl()} title="No transfers yet" subtitle="File operations like copy, move, and archive will appear here." />
      ) : (
            <>
              {renderJobGroup(jobs, completedCollapsed, setCompletedCollapsed, onCancel, onPause, onResume, onRetry)}
              {jobs.some((j) => j.status === 'completed' || j.status === 'cancelled') && (
                <Button size="compact" onClick={onClearCompleted}>
                  Clear completed
                </Button>
              )}
              {jobs.some((j) => j.status === 'failed') && (
                <Button size="compact" onClick={onClearFailed}>
                  Clear failed
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
