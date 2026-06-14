import { useEffect, useRef } from 'react';
import { cancelJob, getJobs, pauseJob, resumeJob, retryJob, retryJobItem, clearCompletedJobs, clearFailedJobs, resolveJobConflicts } from '../api/client';
import { apiUrl } from '../api/baseUrl';
import { makeJobLabel, refreshesFiles } from '../utils/jobs';
import type { Job, Session } from '../api/client';

interface UseJobsOptions {
  session: Session | null;
  sessionLoading: boolean;
  onRefresh: () => void;
  showToast: (title: string, variant?: 'success' | 'error', message?: string) => void;
}

export function useJobs(
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>,
  { session, sessionLoading, onRefresh, showToast }: UseJobsOptions,
) {
  const knownJobIds = useRef(new Set<string>());
  const jobStatuses = useRef(new Map<string, string>());
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    getJobs()
      .then((response) => {
        const initialJobs = response.jobs ?? [];
        knownJobIds.current = new Set(initialJobs.map((j) => j.id));
        jobStatuses.current = new Map(initialJobs.map((j) => [j.id, j.status]));
        setJobs(initialJobs);
      })
      .catch((err) => console.error('Failed to fetch jobs:', err));

    const events = new EventSource(apiUrl('/api/jobs/events'));
    events.addEventListener('jobs', (event) => {
      let nextJobs: Job[] = [];
      try {
        const response = JSON.parse((event as MessageEvent).data) as { jobs: Job[] | null };
        nextJobs = response.jobs ?? [];
      } catch (e) {
        console.warn('Failed to parse SSE job event:', e);
        return;
      }
      for (const job of nextJobs) {
        const previousStatus = jobStatuses.current.get(job.id);
        if (job.status === 'completed' && previousStatus !== 'completed' && refreshesFiles(job)) {
          refreshRef.current();
        }
        if (typeof Notification !== 'undefined' && !knownJobIds.current.has(job.id) && Notification.permission === 'granted') {
          if (job.status === 'completed') {
            new Notification(makeJobLabel(job.type, 'completed'), { body: `${job.sourcePath ?? job.id}` });
          } else if (job.status === 'failed') {
            new Notification(makeJobLabel(job.type, 'failed'), { body: `${job.errorMessage ?? job.id}` });
          }
        }
      }
      knownJobIds.current = new Set(nextJobs.map((j) => j.id));
      jobStatuses.current = new Map(nextJobs.map((j) => [j.id, j.status]));
      setJobs(nextJobs);
    });
    events.onerror = () => {
      console.warn('SSE connection lost, will auto-reconnect');
    };
    return () => events.close();
  }, [session, sessionLoading, setJobs]);

  const runWithToast = async (action: () => Promise<unknown>, successTitle: string) => {
    try {
      await action();
      toastRef.current(successTitle, 'success');
      refreshRef.current();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toastRef.current('Action failed', 'error', msg);
    }
  };

  const handleCancelJob = (id: string, jobType?: string) => {
    const label = jobType ? makeJobLabel(jobType, 'cancelled') : 'Transfer cancelled';
    void runWithToast(async () => {
      await cancelJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, label);
  };

  const handleRetryJob = (id: string, jobType?: string) => {
    const label = jobType ? makeJobLabel(jobType, 'queued for retry') : 'Transfer retried';
    void runWithToast(async () => {
      await retryJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, label);
  };

  const handleRetryItem = (jobId: string, itemId: string) => {
    void runWithToast(async () => {
      await retryJobItem(jobId, itemId);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Item queued for retry');
  };

  const handlePauseJob = (id: string, jobType?: string) => {
    const label = jobType ? makeJobLabel(jobType, 'paused') : 'Transfer paused';
    void runWithToast(async () => {
      await pauseJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, label);
  };

  const handleResumeJob = (id: string, jobType?: string) => {
    const label = jobType ? makeJobLabel(jobType, 'resumed') : 'Transfer resumed';
    void runWithToast(async () => {
      await resumeJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, label);
  };

  const handleClearCompleted = () => {
    void runWithToast(async () => {
      await clearCompletedJobs();
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Completed transfers cleared');
  };

  const handleClearFailed = () => {
    void runWithToast(async () => {
      await clearFailedJobs();
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    }, 'Failed transfers cleared');
  };

  const handleResolveConflicts = async (
    jobId: string,
    items: Array<{ itemId: string; resolution: 'skip' | 'overwrite' | 'rename' }>,
    defaultResolution?: 'skip' | 'overwrite' | 'rename',
  ) => {
    try {
      const result = await resolveJobConflicts(jobId, items, defaultResolution);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
      if (result.resumed) {
        toastRef.current('Conflicts resolved, transfer resumed', 'success');
      } else {
        toastRef.current('Conflicts resolved', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve conflicts';
      toastRef.current('Failed to resolve conflicts', 'error', msg);
    }
  };

  return {
    handleCancelJob,
    handleRetryJob,
    handleRetryItem,
    handlePauseJob,
    handleResumeJob,
    handleClearCompleted,
    handleClearFailed,
    handleResolveConflicts,
  };
}
