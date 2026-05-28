import { useEffect, useState } from 'react';
import { Icon, FileIcon, FolderIcon } from '../ui/Icon';
import { Dialog } from './Dialog';
import { analyzeDiskUsage } from '../../api/client';
import type { DiskUsageNode } from '../../api/client';
import { formatBytes } from '../../utils/format';
import styles from './DiskUsageAnalyzer.module.css';

type DiskUsageAnalyzerProps = {
  path: string;
  onClose: () => void;
};

function UsageBar({ percentage }: { percentage: number }) {
  const color = percentage > 50 ? 'var(--color-danger)' : percentage > 20 ? 'var(--color-brand)' : 'var(--color-text-muted)';
  return (
    <span className={styles.usageBar}>
      <span className={styles.usageBarFill} style={{ width: `${Math.min(percentage, 100)}%`, background: color }} />
    </span>
  );
}

function TreeNode({ node, depth, total }: { node: DiskUsageNode; depth: number; total: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const barWidth = total > 0 ? (node.size / total) * 100 : 0;

  return (
    <div className={styles.treeNode}>
      <div
        className={styles.treeNodeRow}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasChildren) setExpanded(!expanded); } }}
      >
        {hasChildren ? (
          <Icon name={expanded ? 'go-down' : 'go-next'} size={12} className={styles.treeChevron} />
        ) : (
          <span className={styles.treeSpacer} />
        )}
        {node.isDir ? <FolderIcon size={18} /> : <FileIcon entry={{ name: node.name, type: 'file', path: node.path, size: node.size, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false }} size={18} />}
        <span className={styles.treeName}>{node.name}</span>
        <span className={styles.treeSize}>{formatBytes(node.size)}</span>
        <span className={styles.treePercent}>{node.percentage.toFixed(1)}%</span>
        <div className={styles.treeBarWrapper}>
          <div className={styles.treeBar} style={{ width: `${Math.min(barWidth, 100)}%` }} />
        </div>
      </div>
      {expanded && hasChildren && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} total={total} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiskUsageAnalyzer({ path, onClose }: DiskUsageAnalyzerProps) {
  const [data, setData] = useState<DiskUsageNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyzeDiskUsage(path)
      .then((node) => { if (!cancelled) setData(node); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path]);

  const total = data?.size ?? 0;

  return (
    <Dialog title="Disk Usage Analyzer" subtitle={path} onClose={onClose} width="xl">
      <div className={styles.body}>
        {loading && (
          <div className={styles.loading}>
            <Icon name="view-refresh" size={20} />
            <span>Scanning directory tree...</span>
          </div>
        )}
        {error && (
          <div className={styles.error}>
            <Icon name="dialog-warning" size={18} />
            <span>{error}</span>
          </div>
        )}
        {data && !loading && !error && (
          <>
            <div className={styles.summary}>
              <span className={styles.summaryLabel}>Total size:</span>
              <span className={styles.summaryValue}>{formatBytes(total)}</span>
              <UsageBar percentage={100} />
            </div>
            <div className={styles.header}>
              <span className={styles.headerSpacer} />
              <span className={styles.headerName}>Name</span>
              <span className={styles.headerSize}>Size</span>
              <span className={styles.headerPercent}>%</span>
              <span className={styles.headerBar}>Usage</span>
            </div>
            <div className={styles.tree} role="tree">
              {data.children && data.children.length > 0 ? (
                data.children.map((child) => (
                  <TreeNode key={child.path} node={child} depth={0} total={total} />
                ))
              ) : (
                <div className={styles.empty}><span>No files found</span></div>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
