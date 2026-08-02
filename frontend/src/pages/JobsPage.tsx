import { useState, useEffect } from 'react';
import type { Session } from '../api/client-auth';
import type { Job, JobStatus } from '../api/client-jobs';
import { getJobs } from '../api/client-jobs';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { jobsIconUrl } from '../api/icons';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button, StatusBadge } from '../components/ui/shared';
import { formatBytes, formatDuration, formatGridDate } from '../utils/format';
import { isAnalysisJob, makeJobLabel } from '../utils/jobs';
import { useJobs } from '../hooks/useJobs';
import { useShellContext } from '../contexts/ShellContext';
import { RefreshContextMenu } from '../components/overlay/RefreshContextMenu';
import { ConflictDialog } from '../components/overlay/ConflictDialog';
import { ConfirmDialog, type ConfirmDialogState } from '../components/overlay/ConfirmDialog';
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
  onOpenAnalysis,
  canManage,
}: {
  job: Job;
  onCancel: (id: string, type: string) => void;
  onPause: (id: string, type: string) => void;
  onResume: (id: string, type: string) => void;
  onRetry: (id: string, type: string) => void;
  onResolve: (id: string) => void;
  onOpenAnalysis?: (job: Job) => void;
  canManage: boolean;
}) {
  const isAnalysis = isAnalysisJob(job);
  const progress =
    job.status === 'completed'
      ? 100
      : job.totalBytes > 0
        ? Math.round((job.processedBytes / job.totalBytes) * 100)
        : job.totalItems > 0
          ? Math.round((job.processedItems / job.totalItems) * 100)
          : 0;
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
      tabIndex={
        isAnalysis ||
        (canManage && (canPause || canResume || canCancel || canRetry || needsResolve))
          ? 0
          : -1
      }
      data-job-id={job.id}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter' && isAnalysis && onOpenAnalysis) {
          e.preventDefault();
          onOpenAnalysis(job);
        }
      }}
    >
      <div className={styles.jobTitleRow}>
        <span className={styles.jobTitleLabel}>
          <Icon name={`job-${job.type}`} size={15} />
          <strong>{makeJobLabel(job.type, '')}</strong>
        </span>
        <StatusBadge variant={jobVariant(job.status)}>{job.status}</StatusBadge>
      </div>
      <ProgressBar value={progress} />
      <div className={styles.jobMeta}>
        {job.totalItems > 1 && (
          <span>
            {job.processedItems} / {job.totalItems} items
          </span>
        )}
        {!isAnalysis && <span>{byteProgress}</span>}
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
      {(isAnalysis ||
        (canManage && (canPause || canResume || canCancel || canRetry || needsResolve))) && (
        <div className={styles.jobActions}>
          {isAnalysis && onOpenAnalysis && (
            <Button size="compact" variant="primary" onClick={() => onOpenAnalysis(job)}>
              <Icon name="document-open" size={15} />
              {job.status === 'completed' ? 'View results' : 'Open scan'}
            </Button>
          )}
          {canManage && needsResolve && (
            <Button size="compact" variant="primary" onClick={() => onResolve(job.id)}>
              <Icon name="dialog-warning" size={15} />
              Resolve Conflicts
            </Button>
          )}
          {canManage && canPause && (
            <Button size="compact" onClick={() => onPause(job.id, job.type)}>
              <Icon name="media-playback-pause" size={15} />
              Pause
            </Button>
          )}
          {canManage && canResume && (
            <Button size="compact" onClick={() => onResume(job.id, job.type)}>
              <Icon name="media-playback-start" size={15} />
              Resume
            </Button>
          )}
          {canManage && canCancel && (
            <Button size="compact" onClick={() => onCancel(job.id, job.type)}>
              <Icon name="process-stop" size={15} />
              Cancel
            </Button>
          )}
          {canManage && canRetry && (
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
  onOpenAnalysis?: (job: Job) => void;
};

function handleJobListKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!(e.target instanceof HTMLElement) || !e.target.hasAttribute('data-job-id')) return;
    e.preventDefault();
    const items = document.querySelectorAll<HTMLElement>('[data-job-id]');
    const current = document.activeElement;
    const idx = Array.from(items).indexOf(current as HTMLElement);
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
    items[next]?.focus();
  }
}

export function JobsPage({ session, sessionLoading, onOpenAnalysis }: JobsPageProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsEmptyMenu, setJobsEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [conflictDialogJobId, setConflictDialogJobId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const shell = useShellContext();
  const canManage = session?.role === 'admin';

  const {
    loading: jobsLoading,
    error: jobsError,
    clearError: clearJobsError,
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
      shell.showToastObj({ title, variant: variant ?? 'success', message }),
  });

  const refreshJobs = async (announce = false) => {
    setRetrying(true);
    setRetryError(null);
    clearJobsError();
    try {
      const response = await getJobs();
      setJobs(response.jobs ?? []);
      if (announce) shell.showToastObj({ title: 'Refreshed', variant: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load jobs';
      setRetryError(message);
      if (announce) {
        shell.showToastObj({ title: 'Refresh failed', message, variant: 'error' });
      }
    } finally {
      setRetrying(false);
    }
  };

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

  const toolbar = (
    <div className={styles.jobHeader}>
      <div>
        <h2>Jobs</h2>
        <p>Background file work and storage analyses.</p>
      </div>
      {jobs.length > 0 && canManage && (
        <div className={styles.jobToolbar}>
          {hasFailed && (
            <Button
              size="compact"
              onClick={() =>
                setConfirmDialog({
                  title: 'Clear failed jobs?',
                  message: 'Failed job history will be removed. This cannot be undone.',
                  confirmLabel: 'Clear failed',
                  danger: true,
                  onConfirm: handleClearFailed,
                })
              }
              aria-label="Clear failed"
              title="Clear failed"
            >
              <Icon name="dialog-warning" size={18} />
              <span className={styles.clearLabel}>Clear failed</span>
            </Button>
          )}
          {hasCompleted && (
            <Button
              size="compact"
              onClick={() =>
                setConfirmDialog({
                  title: 'Clear completed jobs?',
                  message:
                    'Completed and cancelled job history, including saved analyzer results, will be removed. This cannot be undone.',
                  confirmLabel: 'Clear completed',
                  danger: true,
                  onConfirm: handleClearCompleted,
                })
              }
              aria-label="Clear completed"
              title="Clear completed"
            >
              <Icon name="edit-clear" size={18} />
              <span className={styles.clearLabel}>Clear completed</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );

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
            aria-label="Previous page"
            title="Previous page"
          >
            <Icon name="pan-left" size={15} />
          </Button>
          <Button
            size="compact"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            title="Next page"
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
        {(jobsLoading || retrying) && jobs.length === 0 ? (
          <div className={styles.loading} role="status">
            <Icon name="view-refresh" size={18} />
            Loading jobs…
          </div>
        ) : (jobsError || retryError) && jobs.length === 0 ? (
          <ErrorBanner
            message={jobsError || retryError || 'Failed to load jobs'}
            onRetry={() => void refreshJobs()}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={jobsIconUrl()}
            title="No jobs yet"
            subtitle="File operations and storage analyses will appear here."
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
                onOpenAnalysis={onOpenAnalysis}
                canManage={canManage}
              />
            ))}
          </>
        )}
      </AppPanel>
      {jobsEmptyMenu && (
        <RefreshContextMenu
          x={jobsEmptyMenu.x}
          y={jobsEmptyMenu.y}
          onRefresh={() => {
            void refreshJobs(true);
          }}
          onClose={() => setJobsEmptyMenu(null)}
        />
      )}
      {canManage && conflictDialogJobId && (
        <ConflictDialog
          jobId={conflictDialogJobId}
          onResolve={(items, defaultResolution) => {
            handleResolveConflicts(conflictDialogJobId, items, defaultResolution);
            setConflictDialogJobId(null);
          }}
          onClose={() => setConflictDialogJobId(null)}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      )}
    </>
  );
}
