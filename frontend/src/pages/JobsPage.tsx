import { useState, useEffect } from 'react';
import type { Job, JobStatus, Session } from '../api/client';
import { getJobs } from '../api/client';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { jobsIconUrl } from '../api/icons';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button, StatusBadge } from '../components/ui/shared';
import { formatBytes, formatGridDate } from '../utils/format';
import { useJobs } from '../hooks/useJobs';
import { useToasts } from '../hooks/useToasts';
import { JobsEmptyMenu } from '../components/overlay/JobsEmptyMenu';
import styles from './JobsPage.module.css';

const jobVariant = (status: JobStatus): 'success' | 'warning' | 'danger' | 'disabled' => {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'warning';
  if (status === 'failed') return 'danger';
  return 'disabled';
};

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
        <span className={styles.jobTitleLabel}>
          <Icon name={`job-${job.type}`} size={15} />
          <strong>{job.type}</strong>
        </span>
        <StatusBadge variant={jobVariant(job.status)}>{job.status}</StatusBadge>
      </div>
      <ProgressBar value={progress} />
      <div className={styles.jobMeta}>
        {job.totalItems > 1 && (
          <span>{job.processedItems} / {job.totalItems} files</span>
        )}
        <span>
          {hasKnownTotal
            ? `${formatBytes(job.processedBytes)} / ${formatBytes(job.totalBytes)}`
            : `${formatBytes(job.processedBytes)} uploaded`}
        </span>
        <span className={!showLiveStats ? styles.mutedPlaceholder : undefined}>
          {showLiveStats && job.speedBytesPerSecond ? `${formatBytes(job.speedBytesPerSecond)}/s` : '\u2014/s'}
        </span>
        <span className={!showLiveStats ? styles.mutedPlaceholder : undefined}>
          {showLiveStats && job.etaSeconds !== undefined ? `${formatDuration(job.etaSeconds)} left` : '\u2014 left'}
        </span>
      </div>
      <div className={styles.jobFooter}>
        <span className={styles.jobTimestamp}>Created {formatGridDate(job.createdAt)}</span>
        {job.updatedAt !== job.createdAt && (
          <span className={styles.jobTimestamp}>Updated {formatGridDate(job.updatedAt)}</span>
        )}
      </div>
      {job.currentItem ?? job.sourcePath ? <p className={styles.jobPath}>{job.currentItem ?? job.sourcePath}</p> : null}
      {job.errorMessage && <p className={styles.jobError}><Icon name="dialog-warning" size={14} /> {job.errorMessage}</p>}
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

type JobsPageProps = {
  session: Session | null;
  sessionLoading: boolean;
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

export function JobsPage({ session, sessionLoading }: JobsPageProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsEmptyMenu, setJobsEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const toast = useToasts();

  const {
    handleCancelJob, handleRetryJob,
    handlePauseJob, handleResumeJob,
    handleClearCompleted, handleClearFailed,
  } = useJobs(setJobs, {
    session,
    sessionLoading,
    onRefresh: () => {},
    showToast: (title, variant, message) => toast.showToastObj({ title, variant: variant ?? 'success', message }),
  });

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const pageJobs = jobs.slice(startIndex, startIndex + pageSize);

  const hasCompleted = jobs.some((j) => j.status === 'completed' || j.status === 'cancelled');
  const hasFailed = jobs.some((j) => j.status === 'failed');

  const handleJobsEmptyContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setJobsEmptyMenu({ x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <main className={styles.jobsPage} onContextMenu={handleJobsEmptyContextMenu}>
        {jobs.length > 0 && (
          <div className={styles.jobToolbar}>
            {hasFailed && (
              <Button size="compact" onClick={handleClearFailed}>
                Clear failed
              </Button>
            )}
            {hasCompleted && (
              <Button size="compact" onClick={handleClearCompleted}>
                Clear completed
              </Button>
            )}
          </div>
        )}
        <div className={styles.jobList} onKeyDown={handleJobListKeyDown} role="list">
          {jobs.length === 0 ? (
            <EmptyState icon={jobsIconUrl()} title="No transfers yet" subtitle="File operations like copy, move, and archive will appear here." />
          ) : (
            <>
              {pageJobs.map((job) => (
                <JobItem key={job.id} job={job} onCancel={handleCancelJob} onPause={handlePauseJob} onResume={handleResumeJob} onRetry={handleRetryJob} />
              ))}
            </>
          )}
        </div>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <div className={styles.paginationButtons}>
              <Button size="compact" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <Icon name="pan-left" size={15} />
              </Button>
              <Button size="compact" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                <Icon name="pan-right" size={15} />
              </Button>
            </div>
          </div>
        )}
      </main>
      {jobsEmptyMenu && (
        <JobsEmptyMenu
          x={jobsEmptyMenu.x} y={jobsEmptyMenu.y}
          onRefresh={() => {
            getJobs().then((r) => setJobs(r.jobs ?? []));
            toast.showToastObj({ title: 'Refreshed', variant: 'success' });
          }}
          onClose={() => setJobsEmptyMenu(null)}
        />
      )}
    </>
  );
}
