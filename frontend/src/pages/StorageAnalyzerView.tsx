import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, FileIcon, FolderIcon } from '../components/ui/Icon';
import { AppPanel } from '../components/layout/AppPanel';
import {
  cancelJob,
  createJob,
  getDiskUsageResults,
  getDiskUsageSummary,
  getDuplicateResults,
  getDuplicateSummary,
  deletePath,
} from '../api/client';
import { ConfirmDialog } from '../components/overlay/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import type {
  Job,
  DiskUsageResult,
  DiskUsageSummary,
  DuplicateFileEntry,
  DuplicateSummary,
  RootEntry,
} from '../api/client';
import { formatBytes, formatGridDate } from '../utils/format';
import styles from './StorageAnalyzerView.module.css';

type Section = 'disk-usage' | 'duplicates';

interface StorageAnalyzerViewProps {
  roots: RootEntry[];
  jobs: Job[];
  preselectedPath?: string;
  preselectedSection?: Section;
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
        aria-expanded={node.expanded}
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
}: {
  roots: RootEntry[];
  onStartScan: (path: string) => void;
  loading: boolean;
}) {
  const [customPath, setCustomPath] = useState('/storage');
  return (
    <div className={styles.picker}>
      <h3 className={styles.pickerTitle}>Scan a directory</h3>
      <div className={styles.pickerRoots}>
        {roots.map((r) => (
          <button
            key={r.path}
            className={styles.rootBtn}
            onClick={() => onStartScan(r.path)}
            disabled={loading}
          >
            <FolderIcon size={20} />
            <span>{r.label || r.path}</span>
          </button>
        ))}
      </div>
      <div className={styles.pickerCustom}>
        <input
          className={styles.pickerInput}
          value={customPath}
          onChange={(e) => setCustomPath(e.target.value)}
          placeholder="Enter path..."
        />
        <button
          className={styles.scanBtn}
          onClick={() => onStartScan(customPath)}
          disabled={loading || !customPath}
        >
          {loading ? <Icon name="view-refresh" size={16} /> : <Icon name="edit-find" size={16} />}
          <span>Scan</span>
        </button>
      </div>
    </div>
  );
}

export function StorageAnalyzerView({
  roots,
  jobs,
  preselectedPath,
  preselectedSection,
}: StorageAnalyzerViewProps) {
  const [section, setSection] = useState<Section>(preselectedSection || 'disk-usage');
  const [scanPath, setScanPath] = useState<string | null>(preselectedPath || null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<Map<string, DiskUsageResult[]>>(new Map());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<DiskUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preselectedScanStarted = useRef(false);

  // Duplicate scan state
  const [dupJobId, setDupJobId] = useState<string | null>(null);
  const [dupPath, setDupPath] = useState<string | null>(null);
  const [dupResults, setDupResults] = useState<DuplicateFileEntry[]>([]);
  const [dupSummary, setDupSummary] = useState<DuplicateSummary | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [dupSelected, setDupSelected] = useState<Set<string>>(new Set());
  const [dupTrashing, setDupTrashing] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);

  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find((j) => j.id === currentJobId) || null;
  }, [jobs, currentJobId]);

  const dupJob = useMemo(() => {
    if (!dupJobId) return null;
    return jobs.find((j) => j.id === dupJobId) || null;
  }, [jobs, dupJobId]);

  const isScanActive =
    currentJob && (currentJob.status === 'queued' || currentJob.status === 'running');
  const isScanDone =
    currentJob &&
    (currentJob.status === 'completed' ||
      currentJob.status === 'failed' ||
      currentJob.status === 'cancelled');

  const startScan = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setScanPath(path);
    try {
      const job = await createJob({
        type: 'disk_analyze',
        sourcePath: path,
        conflictPolicy: 'ask',
        verifyMode: 'size',
      });
      setCurrentJobId(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!preselectedPath || preselectedScanStarted.current) return;
    preselectedScanStarted.current = true;
    void startScan(preselectedPath);
  }, [preselectedPath, startScan]);

  const startDupScan = useCallback(async (path: string) => {
    setDupLoading(true);
    setDupError(null);
    setDupPath(path);
    setDupResults([]);
    setDupSummary(null);
    setDupSelected(new Set());
    try {
      const job = await createJob({
        type: 'duplicate_find',
        sourcePath: path,
        conflictPolicy: 'ask',
        verifyMode: 'size',
      });
      setDupJobId(job.id);
    } catch (err) {
      setDupError(err instanceof Error ? err.message : 'Failed to start duplicate scan');
    } finally {
      setDupLoading(false);
    }
  }, []);

  const loadChildren = useCallback(
    async (parentPath: string) => {
      if (!currentJobId) return;
      try {
        const res = await getDiskUsageResults(currentJobId, parentPath);
        setTreeData((prev) => {
          const next = new Map(prev);
          next.set(parentPath, res.results);
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
      const [res, s] = await Promise.all([
        getDuplicateResults(dupJobId, 1000, 0),
        getDuplicateSummary(dupJobId),
      ]);
      setDupResults(res.results);
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
    if (!dupJob) return;
    if (dupJob.status === 'completed' || dupJob.status === 'failed') {
      loadDupResults();
    }
  }, [dupJob, loadDupResults]);

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

  const handleSelectDup = useCallback((path: string) => {
    setDupSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleTrashSelected = useCallback(async () => {
    if (dupSelected.size === 0) return;
    setDupTrashing(true);
    try {
      await Promise.all(
        Array.from(dupSelected).map((p) => deletePath(p, p.split('/').pop() || '')),
      );
      setDupResults((prev) => prev.filter((r) => !dupSelected.has(r.path)));
      setDupSelected(new Set());
    } catch {
      setDupError('Failed to trash some files');
    } finally {
      setDupTrashing(false);
    }
  }, [dupSelected]);

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
    setError(null);
  }, []);

  const resetDuplicateScan = useCallback(() => {
    setDupJobId(null);
    setDupPath(null);
    setDupResults([]);
    setDupSummary(null);
    setDupSelected(new Set());
    setDupError(null);
  }, []);

  const cancelCurrentScan = useCallback(async (jobId: string, duplicate = false) => {
    try {
      await cancelJob(jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel scan';
      if (duplicate) setDupError(message);
      else setError(message);
    }
  }, []);

  const retry = useCallback(() => {
    if (scanPath) startScan(scanPath);
  }, [scanPath, startScan]);

  const retryDup = useCallback(() => {
    if (dupPath) startDupScan(dupPath);
  }, [dupPath, startDupScan]);

  return (
    <AppPanel
      as="main"
      layout="split"
      padding="none"
      scroll={false}
      sidebar={
        <div className={styles.tabs} role="tablist" aria-label="Storage analysis mode">
          <button
            className={`${styles.tab}${section === 'disk-usage' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setSection('disk-usage')}
            role="tab"
            aria-selected={section === 'disk-usage'}
          >
            <Icon name="drive-harddisk" size={18} />
            <span>Disk Usage</span>
          </button>
          <button
            className={`${styles.tab}${section === 'duplicates' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setSection('duplicates')}
            role="tab"
            aria-selected={section === 'duplicates'}
          >
            <Icon name="edit-copy" size={18} />
            <span>Duplicates</span>
          </button>
        </div>
      }
    >
      {section === 'disk-usage' && (
        <div className={styles.body}>
          {!scanPath && !currentJobId && (
            <PathPicker roots={roots} onStartScan={startScan} loading={loading} />
          )}

          {scanPath && !currentJobId && loading && (
            <div className={styles.status}>
              <Icon name="view-refresh" size={20} />
              <span>Starting scan...</span>
            </div>
          )}

          {error && (
            <div className={styles.errorBanner}>
              <Icon name="dialog-warning" size={16} />
              <span>{error}</span>
              <button className={styles.retryBtn} onClick={retry}>
                Retry
              </button>
            </div>
          )}

          {scanPath && currentJob && isScanActive && (
            <div className={styles.scanStatus}>
              <Icon name="view-refresh" size={20} />
              <span>Scanning {scanPath}...</span>
              {currentJob.currentItem && (
                <span className={styles.currentItem}>{currentJob.currentItem}</span>
              )}
              <span className={styles.processedCount}>{currentJob.processedItems} items found</span>
              <button
                className={styles.secondaryBtn}
                onClick={() => void cancelCurrentScan(currentJob.id)}
              >
                Cancel
              </button>
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
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => scanPath && void startScan(scanPath)}
                  >
                    Rescan
                  </button>
                  <button className={styles.secondaryBtn} onClick={resetDiskScan}>
                    Scan another folder
                  </button>
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

          {summary && isScanDone && currentJob?.status === 'failed' && (
            <div className={styles.status}>
              <Icon name="dialog-warning" size={18} />
              <span>Scan failed: {currentJob.errorMessage}</span>
              <button className={styles.retryBtn} onClick={retry}>
                Retry
              </button>
            </div>
          )}
          {currentJob?.status === 'cancelled' && (
            <div className={styles.status}>
              <span>Scan cancelled.</span>
              <button className={styles.secondaryBtn} onClick={resetDiskScan}>
                Scan another folder
              </button>
            </div>
          )}
        </div>
      )}

      {section === 'duplicates' && (
        <div className={styles.body}>
          {!dupJobId && !dupPath && (
            <PathPicker roots={roots} onStartScan={startDupScan} loading={dupLoading} />
          )}

          {dupPath && !dupJobId && dupLoading && (
            <div className={styles.status}>
              <Icon name="view-refresh" size={20} />
              <span>Starting duplicate scan...</span>
            </div>
          )}

          {dupError && (
            <div className={styles.errorBanner}>
              <Icon name="dialog-warning" size={16} />
              <span>{dupError}</span>
              <button className={styles.retryBtn} onClick={retryDup}>
                Retry
              </button>
            </div>
          )}

          {dupJob && (dupJob.status === 'queued' || dupJob.status === 'running') && (
            <div className={styles.scanStatus}>
              <Icon name="view-refresh" size={20} />
              <span>Scanning for duplicates in {dupPath}...</span>
              {dupJob.currentItem && (
                <span className={styles.currentItem}>{dupJob.currentItem}</span>
              )}
              <span className={styles.processedCount}>{dupJob.processedItems} files scanned</span>
              <button
                className={styles.secondaryBtn}
                onClick={() => void cancelCurrentScan(dupJob.id, true)}
              >
                Cancel
              </button>
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
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => dupPath && void startDupScan(dupPath)}
                  >
                    Rescan
                  </button>
                  <button className={styles.secondaryBtn} onClick={resetDuplicateScan}>
                    Scan another folder
                  </button>
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

              {dupSelected.size > 0 && (
                <div className={styles.bulkBar}>
                  <span>{dupSelected.size} file(s) selected</span>
                  <button
                    className={styles.trashBtn}
                    onClick={requestTrashSelected}
                    disabled={dupTrashing}
                  >
                    {dupTrashing ? (
                      <Icon name="view-refresh" size={16} />
                    ) : (
                      <Icon name="edit-delete" size={16} />
                    )}
                    <span>Trash selected</span>
                  </button>
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
                      {files.map((f) => (
                        <div key={f.path} className={styles.dupFile}>
                          <label className={styles.dupCheck}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${f.path}`}
                              checked={dupSelected.has(f.path)}
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
                        </div>
                      ))}
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
                <button className={styles.secondaryBtn} onClick={resetDuplicateScan}>
                  Scan another folder
                </button>
              </EmptyState>
            </div>
          )}

          {dupJob?.status === 'failed' && (
            <div className={styles.status}>
              <Icon name="dialog-warning" size={18} />
              <span>Scan failed: {dupJob.errorMessage}</span>
              <button className={styles.retryBtn} onClick={retryDup}>
                Retry
              </button>
            </div>
          )}
          {dupJob?.status === 'cancelled' && (
            <div className={styles.status}>
              <span>Duplicate scan cancelled.</span>
              <button className={styles.secondaryBtn} onClick={resetDuplicateScan}>
                Scan another folder
              </button>
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
