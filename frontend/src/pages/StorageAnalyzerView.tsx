import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, FileIcon, FolderIcon } from '../components/ui/Icon';
import { AppPanel } from '../components/layout/AppPanel';
import { FolderPicker } from '../components/input/FolderPicker';
import {
  getDiskUsageResults,
  getDiskUsageSummary,
  getDuplicateResults,
  getDuplicateSummary,
  deletePath,
} from '../api/client-files';
import { cancelJob, createJob } from '../api/client-jobs';
import { ConfirmDialog } from '../components/overlay/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/shared';
import type {
  DiskUsageResult,
  DiskUsageSummary,
  DuplicateFileEntry,
  DuplicateSummary,
  RootEntry,
} from '../api/client-files';
import type { Job } from '../api/client-jobs';
import { formatBytes, formatGridDate } from '../utils/format';
import { isAnalysisJob } from '../utils/jobs';
import styles from './StorageAnalyzerView.module.css';

type Section = 'disk-usage' | 'duplicates';
const ANALYSIS_PAGE_SIZE = 500;

interface StorageAnalyzerViewProps {
  roots: RootEntry[];
  jobs: Job[];
  preselectedPath?: string;
  preselectedSection?: Section;
  initialJobId?: string;
  canManage?: boolean;
}

type TreeNode = DiskUsageResult & {
  children?: TreeNode[];
  expanded: boolean;
  loaded: boolean;
  percentage: number;
};

function DirRow({
  node,
  totalBytes,
  onToggle,
  depth,
}: {
  node: TreeNode;
  totalBytes: number;
  onToggle: (path: string) => void;
  depth: number;
}) {
  const barWidth = totalBytes > 0 ? (node.sizeBytes / totalBytes) * 100 : 0;
  return (
    <div>
      <div
        className={styles.dirRow}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => node.isDir && onToggle(node.path)}
        role="treeitem"
        aria-expanded={node.isDir ? node.expanded : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && node.isDir) {
            e.preventDefault();
            onToggle(node.path);
          }
        }}
      >
        {node.isDir ? (
          <Icon name={node.expanded ? 'go-down' : 'go-next'} size={12} className={styles.chevron} />
        ) : (
          <span className={styles.spacer} />
        )}
        {node.isDir ? (
          <FolderIcon size={18} />
        ) : (
          <FileIcon
            entry={{
              name: node.name,
              type: 'file',
              path: node.path,
              size: node.sizeBytes,
              modifiedAt: '',
              permissions: '',
              owner: '',
              group: '',
              hidden: false,
            }}
            size={18}
          />
        )}
        <span className={styles.name}>{node.name}</span>
        <span className={styles.size}>{formatBytes(node.sizeBytes)}</span>
        <span className={styles.percent}>{node.percentage.toFixed(1)}%</span>
        <div className={styles.barWrapper}>
          <div className={styles.bar} style={{ width: `${Math.min(barWidth, 100)}%` }} />
        </div>
      </div>
      {node.expanded &&
        node.children?.map((child) => (
          <DirRow
            key={child.path}
            node={child}
            totalBytes={totalBytes}
            onToggle={onToggle}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function PathPicker({
  roots,
  onStartScan,
  loading,
  canStart,
}: {
  roots: RootEntry[];
  onStartScan: (path: string) => void;
  loading: boolean;
  canStart: boolean;
}) {
  const [customPath, setCustomPath] = useState('/storage');
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className={styles.picker}>
      <h3 className={styles.pickerTitle}>Scan a directory</h3>
      <p className={styles.pickerDescription}>Choose a root or enter a folder path to analyze.</p>
      <div className={styles.pickerRoots}>
        {roots.map((r) => (
          <button
            key={r.path}
            className={`${styles.rootBtn}${customPath === r.path ? ` ${styles.rootBtnSelected}` : ''}`}
            onClick={() => setCustomPath(r.path)}
            disabled={loading || !canStart}
            type="button"
            aria-pressed={customPath === r.path}
          >
            <FolderIcon size={20} />
            <span>{r.label || r.path}</span>
          </button>
        ))}
      </div>
      <div className={styles.pickerCustom}>
        <div className={styles.pathField}>
          <input
            className={styles.pickerInput}
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="Enter path..."
            aria-label="Folder path to scan"
            disabled={!canStart}
          />
          <button
            className={styles.browseBtn}
            onClick={() => setPickerOpen((open) => !open)}
            title="Choose folder"
            aria-label="Choose folder"
            type="button"
            disabled={!canStart}
          >
            <Icon name="folder" size={16} />
          </button>
        </div>
        <Button
          className={styles.scanBtn}
          size="compact"
          variant="primary"
          onClick={() => onStartScan(customPath)}
          disabled={!customPath || !canStart}
          busy={loading}
          busyLabel="Scan"
        >
          <Icon name="edit-find" size={16} />
          <span>Scan</span>
        </Button>
      </div>
      {!canStart && (
        <p className={styles.readonlyNote}>Read-only access · scans cannot be started.</p>
      )}
      {pickerOpen && (
        <div className={styles.pickerBrowser}>
          <FolderPicker
            initialPath={customPath}
            title="Select folder to scan"
            onSelect={(path) => {
              setCustomPath(path);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function RecentAnalyses({
  jobs,
  section,
  onOpen,
}: {
  jobs: Job[];
  section: Section;
  onOpen: (job: Job) => void;
}) {
  const type = section === 'disk-usage' ? 'disk_analyze' : 'duplicate_find';
  const recent = jobs
    .filter((job) => job.type === type)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <section className={styles.recent} aria-labelledby={`recent-${section}`}>
      <div className={styles.recentHeading}>
        <div>
          <h3 id={`recent-${section}`}>Recent analyses</h3>
          <p>Reopen a previous scan without running it again.</p>
        </div>
      </div>
      <div className={styles.recentList}>
        {recent.map((job) => (
          <button
            key={job.id}
            type="button"
            className={styles.recentItem}
            onClick={() => onOpen(job)}
          >
            <Icon name={`job-${job.type}`} size={18} />
            <span className={styles.recentInfo}>
              <strong>{job.sourcePath || 'Unknown folder'}</strong>
              <span>
                {formatGridDate(job.updatedAt)} · {job.status.replace('_', ' ')}
              </span>
            </span>
            <span className={styles.recentAction}>
              {job.status === 'completed' ? 'View results' : 'Open'}
              <Icon name="go-next" size={14} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function StorageAnalyzerView({
  roots,
  jobs,
  preselectedPath,
  preselectedSection,
  initialJobId,
  canManage = true,
}: StorageAnalyzerViewProps) {
  const [section, setSection] = useState<Section>(preselectedSection || 'disk-usage');
  const [scanPath, setScanPath] = useState<string | null>(preselectedPath || null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<Map<string, DiskUsageResult[]>>(new Map());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<DiskUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingScanFeed, setAwaitingScanFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preselectedScanStarted = useRef(false);
  const initialJobAttached = useRef<string | null>(null);
  const startingScan = useRef(false);

  // Duplicate scan state
  const [dupJobId, setDupJobId] = useState<string | null>(null);
  const [dupPath, setDupPath] = useState<string | null>(null);
  const [dupResults, setDupResults] = useState<DuplicateFileEntry[]>([]);
  const [dupSummary, setDupSummary] = useState<DuplicateSummary | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [awaitingDupFeed, setAwaitingDupFeed] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [dupSelected, setDupSelected] = useState<Set<string>>(new Set());
  const [pendingDupTrash, setPendingDupTrash] = useState<Map<string, string>>(new Map());
  const [dupTrashing, setDupTrashing] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const activeJobAttached = useRef(false);
  const startingDupScan = useRef(false);

  const openAnalysis = useCallback((job: Job) => {
    if (job.type === 'disk_analyze') {
      setSection('disk-usage');
      setScanPath(job.sourcePath || null);
      setCurrentJobId(job.id);
      setTreeData(new Map());
      setExpandedPaths(new Set());
      setSummary(null);
      setAwaitingScanFeed(false);
      setError(null);
      return;
    }
    if (job.type === 'duplicate_find') {
      setSection('duplicates');
      setDupPath(job.sourcePath || null);
      setDupJobId(job.id);
      setDupResults([]);
      setDupSummary(null);
      setDupSelected(new Set());
      setAwaitingDupFeed(false);
      setDupError(null);
    }
  }, []);

  useEffect(() => {
    if (!initialJobId || initialJobAttached.current === initialJobId) return;
    const job = jobs.find((candidate) => candidate.id === initialJobId);
    if (!job) return;
    initialJobAttached.current = initialJobId;
    openAnalysis(job);
  }, [initialJobId, jobs, openAnalysis]);

  useEffect(() => {
    if (
      initialJobId ||
      preselectedPath ||
      currentJobId ||
      dupJobId ||
      activeJobAttached.current ||
      jobs.length === 0
    ) {
      return;
    }
    activeJobAttached.current = true;
    const active = jobs
      .filter(
        (job) =>
          isAnalysisJob(job) &&
          (job.status === 'queued' || job.status === 'running' || job.status === 'paused'),
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    if (active) openAnalysis(active);
  }, [currentJobId, dupJobId, initialJobId, jobs, openAnalysis, preselectedPath]);

  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find((j) => j.id === currentJobId) || null;
  }, [jobs, currentJobId]);

  const dupJob = useMemo(() => {
    if (!dupJobId) return null;
    return jobs.find((j) => j.id === dupJobId) || null;
  }, [jobs, dupJobId]);
  const dupJobStatus = dupJob?.status;

  useEffect(() => {
    if (awaitingScanFeed && currentJob) setAwaitingScanFeed(false);
  }, [awaitingScanFeed, currentJob]);

  useEffect(() => {
    if (awaitingDupFeed && dupJob) setAwaitingDupFeed(false);
  }, [awaitingDupFeed, dupJob]);

  const isScanActive =
    currentJob &&
    (currentJob.status === 'queued' ||
      currentJob.status === 'running' ||
      currentJob.status === 'paused');
  const isScanDone =
    currentJob &&
    (currentJob.status === 'completed' ||
      currentJob.status === 'failed' ||
      currentJob.status === 'cancelled');

  const startScan = useCallback(
    async (path: string) => {
      if (!canManage || startingScan.current) return;
      startingScan.current = true;
      setLoading(true);
      setAwaitingScanFeed(false);
      setError(null);
      setScanPath(path);
      setCurrentJobId(null);
      setTreeData(new Map());
      setExpandedPaths(new Set());
      setSummary(null);
      try {
        const job = await createJob({
          type: 'disk_analyze',
          sourcePath: path,
          conflictPolicy: 'ask',
          verifyMode: 'size',
        });
        setCurrentJobId(job.id);
        setAwaitingScanFeed(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start scan');
      } finally {
        startingScan.current = false;
        setLoading(false);
      }
    },
    [canManage],
  );

  useEffect(() => {
    if (!preselectedPath || preselectedScanStarted.current) return;
    preselectedScanStarted.current = true;
    void startScan(preselectedPath);
  }, [preselectedPath, startScan]);

  const startDupScan = useCallback(
    async (path: string) => {
      if (!canManage || startingDupScan.current) return;
      startingDupScan.current = true;
      setDupLoading(true);
      setAwaitingDupFeed(false);
      setDupError(null);
      setDupPath(path);
      setDupJobId(null);
      setDupResults([]);
      setDupSummary(null);
      setDupSelected(new Set());
      setPendingDupTrash(new Map());
      try {
        const job = await createJob({
          type: 'duplicate_find',
          sourcePath: path,
          conflictPolicy: 'ask',
          verifyMode: 'size',
        });
        setDupJobId(job.id);
        setAwaitingDupFeed(true);
      } catch (err) {
        setDupError(err instanceof Error ? err.message : 'Failed to start duplicate scan');
      } finally {
        startingDupScan.current = false;
        setDupLoading(false);
      }
    },
    [canManage],
  );

  const loadChildren = useCallback(
    async (parentPath: string) => {
      if (!currentJobId) return;
      try {
        const results: DiskUsageResult[] = [];
        for (let offset = 0; ; offset += ANALYSIS_PAGE_SIZE) {
          const page = await getDiskUsageResults(
            currentJobId,
            parentPath,
            ANALYSIS_PAGE_SIZE,
            offset,
          );
          results.push(...page.results);
          if (page.results.length < ANALYSIS_PAGE_SIZE) break;
        }
        setTreeData((prev) => {
          const next = new Map(prev);
          next.set(parentPath, results);
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scan contents');
      }
    },
    [currentJobId],
  );

  const loadSummary = useCallback(async () => {
    if (!currentJobId) return;
    try {
      const s = await getDiskUsageSummary(currentJobId);
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan summary');
    }
  }, [currentJobId]);

  const loadDupResults = useCallback(async () => {
    if (!dupJobId) return;
    try {
      const [results, s] = await Promise.all([
        (async () => {
          const allResults: DuplicateFileEntry[] = [];
          for (let offset = 0; ; offset += ANALYSIS_PAGE_SIZE) {
            const page = await getDuplicateResults(dupJobId, ANALYSIS_PAGE_SIZE, offset);
            allResults.push(...page.results);
            if (page.results.length < ANALYSIS_PAGE_SIZE) break;
          }
          return allResults;
        })(),
        getDuplicateSummary(dupJobId),
      ]);
      setDupResults(results);
      setDupSummary(s);
    } catch (err) {
      setDupError(err instanceof Error ? err.message : 'Failed to load duplicate results');
    }
  }, [dupJobId]);

  useEffect(() => {
    if (isScanDone && currentJobId && scanPath) {
      void Promise.all([loadSummary(), loadChildren(scanPath)]);
    }
  }, [isScanDone, currentJobId, scanPath, loadSummary, loadChildren]);

  useEffect(() => {
    if (dupJobStatus === 'completed' || dupJobStatus === 'failed') {
      void loadDupResults();
    }
  }, [dupJobStatus, loadDupResults]);

  useEffect(() => {
    if (pendingDupTrash.size === 0) return;
    const completedPaths: string[] = [];
    const failedPaths: string[] = [];
    for (const [path, jobId] of pendingDupTrash) {
      const job = jobs.find((candidate) => candidate.id === jobId);
      if (job?.status === 'completed') completedPaths.push(path);
      if (job?.status === 'failed' || job?.status === 'cancelled') failedPaths.push(path);
    }
    if (completedPaths.length === 0 && failedPaths.length === 0) return;
    if (completedPaths.length > 0) {
      const completed = new Set(completedPaths);
      setDupResults((prev) => prev.filter((result) => !completed.has(result.path)));
    }
    if (failedPaths.length > 0) {
      setDupError(`Failed to trash ${failedPaths.length} file(s).`);
    }
    const finished = new Set([...completedPaths, ...failedPaths]);
    setPendingDupTrash((prev) => {
      const next = new Map(prev);
      for (const path of finished) next.delete(path);
      return next;
    });
  }, [jobs, pendingDupTrash]);

  const rootResults = treeData.get('') || treeData.get(scanPath || '');

  const treeNodes = useMemo((): TreeNode[] => {
    if (!rootResults || !summary) return [];
    const children = rootResults
      .filter((r) => r.parentPath === scanPath || r.parentPath === '' || r.parentPath === null)
      .map((r) => buildNode(r, treeData, expandedPaths, summary.totalBytes));
    return children;
  }, [rootResults, summary, treeData, expandedPaths, scanPath]);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<number, DuplicateFileEntry[]>();
    for (const r of dupResults) {
      const g = groups.get(r.groupId);
      if (g) {
        g.push(r);
      } else {
        groups.set(r.groupId, [r]);
      }
    }
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
  }, [dupResults]);

  const handleToggle = useCallback(
    (path: string) => {
      if (!treeData.has(path)) {
        void loadChildren(path);
      }
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [treeData, loadChildren],
  );

  const handleSelectDup = useCallback(
    (path: string) => {
      if (pendingDupTrash.has(path)) return;
      setDupSelected((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [pendingDupTrash],
  );

  const handleTrashSelected = useCallback(async () => {
    if (!canManage || dupSelected.size === 0) return;
    setDupTrashing(true);
    try {
      const paths = Array.from(dupSelected);
      const results = await Promise.allSettled(
        paths.map(
          async (path) => [path, (await deletePath(path, path.split('/').pop() || '')).id] as const,
        ),
      );
      const queued = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      const failed = paths.filter((_, index) => results[index]?.status === 'rejected');
      if (queued.length > 0) {
        setPendingDupTrash((prev) => new Map([...prev, ...queued]));
      }
      setDupSelected(new Set(failed));
      if (failed.length > 0) setDupError(`Failed to queue ${failed.length} file(s) for Trash.`);
    } catch {
      setDupError('Failed to trash some files');
    } finally {
      setDupTrashing(false);
    }
  }, [canManage, dupSelected]);

  const requestTrashSelected = useCallback(() => {
    const removesEveryCopy = duplicateGroups.some(([, files]) =>
      files.every((file) => dupSelected.has(file.path)),
    );
    if (removesEveryCopy) {
      setDupError('Keep at least one copy from every duplicate group.');
      return;
    }
    setConfirmTrash(true);
  }, [duplicateGroups, dupSelected]);

  const resetDiskScan = useCallback(() => {
    setScanPath(null);
    setCurrentJobId(null);
    setTreeData(new Map());
    setExpandedPaths(new Set());
    setSummary(null);
    setAwaitingScanFeed(false);
    setError(null);
  }, []);

  const resetDuplicateScan = useCallback(() => {
    setDupJobId(null);
    setDupPath(null);
    setDupResults([]);
    setDupSummary(null);
    setDupSelected(new Set());
    setPendingDupTrash(new Map());
    setAwaitingDupFeed(false);
    setDupError(null);
  }, []);

  const cancelCurrentScan = useCallback(
    async (jobId: string, duplicate = false) => {
      if (!canManage) return;
      try {
        await cancelJob(jobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel scan';
        if (duplicate) setDupError(message);
        else setError(message);
      }
    },
    [canManage],
  );

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next =
      event.currentTarget.nextElementSibling ?? event.currentTarget.previousElementSibling;
    if (!(next instanceof HTMLButtonElement)) return;
    next.click();
    next.focus();
  }, []);

  const retry = useCallback(() => {
    setError(null);
    if (currentJobId && scanPath) {
      void Promise.all([loadSummary(), loadChildren(scanPath)]);
      return;
    }
    if (scanPath) void startScan(scanPath);
  }, [currentJobId, loadChildren, loadSummary, scanPath, startScan]);

  const retryDup = useCallback(() => {
    setDupError(null);
    if (dupJobId) {
      void loadDupResults();
      return;
    }
    if (dupPath) void startDupScan(dupPath);
  }, [dupJobId, dupPath, loadDupResults, startDupScan]);

  return (
    <AppPanel
      as="main"
      padding="none"
      scroll={false}
      sidebar={
        <div className={styles.tabs} role="tablist" aria-label="Storage analysis mode">
          <button
            className={`${styles.tab}${section === 'disk-usage' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setSection('disk-usage')}
            role="tab"
            aria-selected={section === 'disk-usage'}
            aria-controls="disk-usage-panel"
            tabIndex={section === 'disk-usage' ? 0 : -1}
            onKeyDown={handleTabKeyDown}
          >
            <Icon name="drive-harddisk" size={18} />
            <span>Disk Usage</span>
          </button>
          <button
            className={`${styles.tab}${section === 'duplicates' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setSection('duplicates')}
            role="tab"
            aria-selected={section === 'duplicates'}
            aria-controls="duplicates-panel"
            tabIndex={section === 'duplicates' ? 0 : -1}
            onKeyDown={handleTabKeyDown}
          >
            <Icon name="edit-copy" size={18} />
            <span>Duplicates</span>
          </button>
        </div>
      }
    >
      {section === 'disk-usage' && (
        <div className={styles.body} id="disk-usage-panel" role="tabpanel" aria-label="Disk usage">
          {!scanPath && !currentJobId && (
            <>
              <PathPicker
                roots={roots}
                onStartScan={startScan}
                loading={loading}
                canStart={canManage}
              />
              <RecentAnalyses jobs={jobs} section="disk-usage" onOpen={openAnalysis} />
            </>
          )}

          {scanPath && (loading || awaitingScanFeed) && (
            <div className={styles.status}>
              <Icon name="view-refresh" size={20} />
              <span>{loading ? 'Starting scan...' : 'Waiting for scan status...'}</span>
            </div>
          )}

          {error && <ErrorBanner message={error} onRetry={retry} />}

          {scanPath && currentJob && isScanActive && (
            <div className={styles.scanStatus}>
              <Icon name="view-refresh" size={20} />
              <span>
                {currentJob.status === 'paused'
                  ? `Scan paused for ${scanPath}`
                  : `Scanning ${scanPath}...`}
              </span>
              {currentJob.currentItem && (
                <span className={styles.currentItem}>{currentJob.currentItem}</span>
              )}
              <span className={styles.processedCount}>{currentJob.processedItems} items found</span>
              {canManage && (
                <Button size="compact" onClick={() => void cancelCurrentScan(currentJob.id)}>
                  Cancel
                </Button>
              )}
            </div>
          )}

          {summary && isScanDone && currentJob?.status === 'completed' && (
            <>
              <div className={styles.scanToolbar}>
                <div>
                  <span className={styles.pathLabel}>Scanned folder</span>
                  <span className={styles.scannedPath}>{scanPath}</span>
                  <span className={styles.completionText}>
                    Completed · {currentJob.processedItems.toLocaleString()} items
                  </span>
                </div>
                <div className={styles.scanActions}>
                  <Button
                    size="compact"
                    onClick={() => scanPath && void startScan(scanPath)}
                    disabled={!canManage || loading || awaitingScanFeed}
                  >
                    <Icon name="view-refresh" size={16} />
                    Rescan
                  </Button>
                  <Button size="compact" onClick={resetDiskScan}>
                    <Icon name="folder" size={16} />
                    Scan another folder
                  </Button>
                </div>
              </div>
              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Total</span>
                  <span className={styles.summaryValue}>{formatBytes(summary.totalBytes)}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Files</span>
                  <span className={styles.summaryValue}>{summary.fileCount.toLocaleString()}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Directories</span>
                  <span className={styles.summaryValue}>
                    {summary.directoryCount.toLocaleString()}
                  </span>
                </div>
                {summary.skippedCount > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Skipped</span>
                    <span className={styles.summaryValue}>
                      {summary.skippedCount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {summary.fileCount === 0 && summary.directoryCount === 0 ? (
                <EmptyState
                  title="This folder is empty"
                  subtitle="Choose another folder to analyze."
                  compact
                />
              ) : treeData.has(scanPath || '') && treeNodes.length === 0 ? (
                <EmptyState
                  title="No subfolders to display"
                  subtitle="The total above is from files directly inside this folder."
                  compact
                />
              ) : (
                <>
                  <div className={styles.headerRow}>
                    <span className={styles.headerSpacer} />
                    <span className={styles.headerName}>Name</span>
                    <span className={styles.headerSize}>Size</span>
                    <span className={styles.headerPercent}>%</span>
                    <span className={styles.headerBar}>Usage</span>
                  </div>
                  <div className={styles.tree} role="tree">
                    {treeNodes.map((node) => (
                      <DirRow
                        key={node.path}
                        node={node}
                        totalBytes={summary.totalBytes}
                        onToggle={handleToggle}
                        depth={0}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {isScanDone && currentJob?.status === 'failed' && (
            <ErrorBanner
              message={`Scan failed: ${currentJob.errorMessage}`}
              onRetry={canManage ? () => scanPath && void startScan(scanPath) : undefined}
            />
          )}
          {currentJob?.status === 'cancelled' && (
            <div className={styles.status}>
              <span>Scan cancelled.</span>
              <Button size="compact" onClick={resetDiskScan}>
                <Icon name="folder" size={16} />
                Scan another folder
              </Button>
            </div>
          )}
        </div>
      )}

      {section === 'duplicates' && (
        <div className={styles.body} id="duplicates-panel" role="tabpanel" aria-label="Duplicates">
          {!dupJobId && !dupPath && (
            <>
              <PathPicker
                roots={roots}
                onStartScan={startDupScan}
                loading={dupLoading}
                canStart={canManage}
              />
              <RecentAnalyses jobs={jobs} section="duplicates" onOpen={openAnalysis} />
            </>
          )}

          {dupPath && (dupLoading || awaitingDupFeed) && (
            <div className={styles.status}>
              <Icon name="view-refresh" size={20} />
              <span>
                {dupLoading ? 'Starting duplicate scan...' : 'Waiting for scan status...'}
              </span>
            </div>
          )}

          {dupError && <ErrorBanner message={dupError} onRetry={retryDup} />}

          {dupJob &&
            (dupJob.status === 'queued' ||
              dupJob.status === 'running' ||
              dupJob.status === 'paused') && (
              <div className={styles.scanStatus}>
                <Icon name="view-refresh" size={20} />
                <span>
                  {dupJob.status === 'paused'
                    ? `Duplicate scan paused for ${dupPath}`
                    : `Scanning for duplicates in ${dupPath}...`}
                </span>
                {dupJob.currentItem && (
                  <span className={styles.currentItem}>{dupJob.currentItem}</span>
                )}
                <span className={styles.processedCount}>{dupJob.processedItems} files scanned</span>
                {canManage && (
                  <Button size="compact" onClick={() => void cancelCurrentScan(dupJob.id, true)}>
                    Cancel
                  </Button>
                )}
              </div>
            )}

          {dupSummary && dupResults.length > 0 && (
            <>
              <div className={styles.scanToolbar}>
                <div>
                  <span className={styles.pathLabel}>Scanned folder</span>
                  <span className={styles.scannedPath}>{dupPath}</span>
                </div>
                <div className={styles.scanActions}>
                  <Button
                    size="compact"
                    onClick={() => dupPath && void startDupScan(dupPath)}
                    disabled={!canManage || dupLoading || awaitingDupFeed}
                  >
                    <Icon name="view-refresh" size={16} />
                    Rescan
                  </Button>
                  <Button size="compact" onClick={resetDuplicateScan}>
                    <Icon name="folder" size={16} />
                    Scan another folder
                  </Button>
                </div>
              </div>
              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Duplicate groups</span>
                  <span className={styles.summaryValue}>{dupSummary.groupCount}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Duplicate files</span>
                  <span className={styles.summaryValue}>{dupSummary.fileCount}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Wasted space</span>
                  <span className={styles.summaryValue}>
                    {formatBytes(dupSummary.reclaimableBytes)}
                  </span>
                </div>
                {dupSummary.skippedCount > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Skipped</span>
                    <span className={styles.summaryValue}>
                      {dupSummary.skippedCount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {canManage && dupSelected.size > 0 && (
                <div className={styles.bulkBar}>
                  <span>{dupSelected.size} file(s) selected</span>
                  <Button
                    className={styles.trashBtn}
                    size="compact"
                    variant="danger"
                    onClick={requestTrashSelected}
                    busy={dupTrashing}
                    busyLabel="Trash selected"
                  >
                    <Icon name="edit-delete" size={16} />
                    <span>Trash selected</span>
                  </Button>
                </div>
              )}

              <div className={styles.dupGroups}>
                {duplicateGroups.map(([gid, files]) => {
                  const first = files[0];
                  if (!first) return null;
                  return (
                    <div key={gid} className={styles.dupGroup}>
                      <div className={styles.dupGroupHeader}>
                        <Icon name="edit-copy" size={14} />
                        <span>
                          {files.length} copies &middot; {formatBytes(first.sizeBytes)} each
                        </span>
                      </div>
                      {files.map((f) => {
                        const pending = pendingDupTrash.has(f.path);
                        return (
                          <div key={f.path} className={styles.dupFile}>
                            <label className={styles.dupCheck}>
                              <input
                                type="checkbox"
                                aria-label={`Select ${f.path}`}
                                checked={dupSelected.has(f.path)}
                                disabled={pending || !canManage}
                                onChange={() => handleSelectDup(f.path)}
                              />
                            </label>
                            <FileIcon
                              entry={{
                                name: f.path.split('/').pop() || '',
                                type: 'file',
                                path: f.path,
                                size: f.sizeBytes,
                                modifiedAt: f.modifiedAt || '',
                                permissions: '',
                                owner: '',
                                group: '',
                                hidden: false,
                              }}
                              size={18}
                            />
                            <span className={styles.dupName}>{f.path.split('/').pop()}</span>
                            <span className={styles.dupPath}>{f.path}</span>
                            {f.modifiedAt && (
                              <span className={styles.dupDate}>{formatGridDate(f.modifiedAt)}</span>
                            )}
                            {pending && (
                              <span className={styles.dupPending}>Moving to Trash...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {dupSummary && dupResults.length === 0 && dupJob?.status === 'completed' && (
            <div className={styles.emptyResult}>
              <EmptyState
                title="No duplicates found"
                subtitle={`No matching file contents were found in ${dupPath}.`}
                compact
              >
                <Button size="compact" onClick={resetDuplicateScan}>
                  <Icon name="folder" size={16} />
                  Scan another folder
                </Button>
              </EmptyState>
            </div>
          )}

          {dupJob?.status === 'failed' && (
            <ErrorBanner
              message={`Scan failed: ${dupJob.errorMessage}`}
              onRetry={canManage ? () => dupPath && void startDupScan(dupPath) : undefined}
            />
          )}
          {dupJob?.status === 'cancelled' && (
            <div className={styles.status}>
              <span>Duplicate scan cancelled.</span>
              <Button size="compact" onClick={resetDuplicateScan}>
                <Icon name="folder" size={16} />
                Scan another folder
              </Button>
            </div>
          )}
          {confirmTrash && (
            <ConfirmDialog
              dialog={{
                title: 'Trash duplicate files?',
                message: `Move ${dupSelected.size} selected file(s) to Trash? At least one copy from every group will be kept.`,
                confirmLabel: 'Move to Trash',
                danger: true,
                onConfirm: () => void handleTrashSelected(),
              }}
              onClose={() => setConfirmTrash(false)}
            />
          )}
        </div>
      )}
    </AppPanel>
  );
}

function buildNode(
  result: DiskUsageResult,
  treeData: Map<string, DiskUsageResult[]>,
  expandedPaths: Set<string>,
  totalBytes: number,
): TreeNode {
  const children = treeData.get(result.path);
  return {
    ...result,
    expanded: expandedPaths.has(result.path),
    loaded: !!children,
    percentage: totalBytes > 0 ? (result.sizeBytes / totalBytes) * 100 : 0,
    children: children?.map((c) => buildNode(c, treeData, expandedPaths, totalBytes)),
  };
}
