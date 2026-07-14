import { useState, useEffect } from 'react';
import type { Job, JobStatus, Session } from '../api/client';
import { getJobs } from '../api/client';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { jobsIconUrl } from '../api/icons';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button, IconButton, StatusBadge } from '../components/ui/shared';
import { formatBytes, formatDuration, formatGridDate } from '../utils/format';
import { useJobs } from '../hooks/useJobs';
import { useToasts } from '../hooks/useToasts';
import { JobsEmptyMenu } from '../components/overlay/JobsEmptyMenu';
import { ConflictDialog } from '../components/overlay/ConflictDialog';
import { AppPanel } from '../components/layout/AppPanel';
import styles from './JobsPage.module.css';

const jobVariant = (
  status: JobStatus,
): 'success' | 'warning' | 'danger' | 'disabled' | 'active' => {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'needs_attention') return 'active';
  return 'disabled';
};

function JobItem({
  job,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onResolve,
}: {
  job: Job;
  onCancel: (id: string, type: string) => void;
  onPause: (id: string, type: string) => void;
  onResume: (id: string, type: string) => void;
  onRetry: (id: string, type: string) => void;
  onResolve: (id: string) => void;
}) {
  const progress = job.totalBytes > 0 ? Math.round((job.processedBytes / job.totalBytes) * 100) : 0;
  const canCancel =
    job.status === 'queued' ||
    job.status === 'running' ||
    job.status === 'paused' ||
    job.status === 'needs_attention';
  const canPause = job.status === 'running';
  const canResume = job.status === 'paused';
  const canRetry = job.status === 'failed' || job.status === 'cancelled';
  const needsResolve = job.status === 'needs_attention';
  const showLiveStats = job.status === 'running';
  const hasKnownTotal = job.totalBytes > 0;
  const byteProgress = hasKnownTotal
    ? `${formatBytes(job.processedBytes)} / ${formatBytes(job.totalBytes)}`
    : formatBytes(job.processedBytes);

  return (
    <article
      className={styles.jobItem}
      role="listitem"
      tabIndex={0}
      data-job-id={job.id}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.stopPropagation();
      }}
    >
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
          <span>
            {job.processedItems} / {job.totalItems} files
          </span>
        )}
        <span>{byteProgress}</span>
        {showLiveStats && job.speedBytesPerSecond ? (
          <span>{formatBytes(job.speedBytesPerSecond)}/s</span>
        ) : null}
        {showLiveStats && job.etaSeconds !== undefined ? (
          <span>{formatDuration(job.etaSeconds)} left</span>
        ) : null}
      </div>
      <div className={styles.jobFooter}>
        <span className={styles.jobTimestamp}>Created {formatGridDate(job.createdAt)}</span>
        {job.updatedAt !== job.createdAt && (
          <span className={styles.jobTimestamp}>Updated {formatGridDate(job.updatedAt)}</span>
        )}
      </div>
      {(job.currentItem ?? job.sourcePath) ? (
        <p className={styles.jobPath}>{job.currentItem ?? job.sourcePath}</p>
      ) : null}
      {job.errorMessage && (
        <p className={styles.jobError}>
          <Icon name="dialog-warning" size={14} /> {job.errorMessage}
        </p>
      )}
      {(canPause || canResume || canCancel || canRetry || needsResolve) && (
        <div className={styles.jobActions}>
          {needsResolve && (
            <Button size="compact" variant="primary" onClick={() => onResolve(job.id)}>
              <Icon name="dialog-warning" size={15} />
              Resolve Conflicts
            </Button>
          )}
          {canPause && (
            <Button size="compact" onClick={() => onPause(job.id, job.type)}>
              <Icon name="media-playback-pause" size={15} />
              Pause
            </Button>
          )}
          {canResume && (
            <Button size="compact" onClick={() => onResume(job.id, job.type)}>
              <Icon name="media-playback-start" size={15} />
              Resume
            </Button>
          )}
          {canCancel && (
            <Button size="compact" onClick={() => onCancel(job.id, job.type)}>
              <Icon name="process-stop" size={15} />
              Cancel
            </Button>
          )}
          {canRetry && (
            <Button size="compact" onClick={() => onRetry(job.id, job.type)}>
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
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
    items[next]?.focus();
  }
}

export function JobsPage({ session, sessionLoading }: JobsPageProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsEmptyMenu, setJobsEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [conflictDialogJobId, setConflictDialogJobId] = useState<string | null>(null);
  const toast = useToasts();

  const {
    handleCancelJob,
    handleRetryJob,
    handlePauseJob,
    handleResumeJob,
    handleClearCompleted,
    handleClearFailed,
    handleResolveConflicts,
  } = useJobs(setJobs, {
    session,
    sessionLoading,
    onRefresh: () => {},
    showToast: (title, variant, message) =>
      toast.showToastObj({ title, variant: variant ?? 'success', message }),
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

  const toolbar =
    jobs.length > 0 ? (
      <div className={styles.jobToolbar}>
        {hasFailed && (
          <IconButton onClick={handleClearFailed} aria-label="Clear failed" title="Clear failed">
            <Icon name="dialog-warning" size={18} />
          </IconButton>
        )}
        {hasCompleted && (
          <IconButton
            onClick={handleClearCompleted}
            aria-label="Clear completed"
            title="Clear completed"
          >
            <Icon name="window-close" size={18} />
          </IconButton>
        )}
      </div>
    ) : null;

  const pagination =
    totalPages > 1 ? (
      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>
          Page {currentPage} of {totalPages}
        </span>
        <div className={styles.paginationButtons}>
          <Button
            size="compact"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <Icon name="pan-left" size={15} />
          </Button>
          <Button
            size="compact"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <Icon name="pan-right" size={15} />
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <AppPanel
        as="main"
        bodyClassName={styles.jobList}
        bodyProps={{ onKeyDown: handleJobListKeyDown, role: 'list' }}
        footer={pagination}
        header={toolbar}
        onContextMenu={handleJobsEmptyContextMenu}
      >
        {jobs.length === 0 ? (
          <EmptyState
            icon={jobsIconUrl()}
            title="No transfers yet"
            subtitle="File operations like copy, move, and archive will appear here."
          />
        ) : (
          <>
            {pageJobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                onCancel={handleCancelJob}
                onPause={handlePauseJob}
                onResume={handleResumeJob}
                onRetry={handleRetryJob}
                onResolve={setConflictDialogJobId}
              />
            ))}
          </>
        )}
      </AppPanel>
      {jobsEmptyMenu && (
        <JobsEmptyMenu
          x={jobsEmptyMenu.x}
          y={jobsEmptyMenu.y}
          onRefresh={() => {
            getJobs().then((r) => setJobs(r.jobs ?? []));
            toast.showToastObj({ title: 'Refreshed', variant: 'success' });
          }}
          onClose={() => setJobsEmptyMenu(null)}
        />
      )}
      {conflictDialogJobId && (
        <ConflictDialog
          jobId={conflictDialogJobId}
          onResolve={(items, defaultResolution) => {
            handleResolveConflicts(conflictDialogJobId, items, defaultResolution);
            setConflictDialogJobId(null);
          }}
          onClose={() => setConflictDialogJobId(null)}
        />
      )}
    </>
  );
}
