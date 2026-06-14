import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton, StatusBadge } from '../ui/shared';
import { Dialog } from './Dialog';
import { EmptyState } from '../ui/EmptyState';
import { getShares, deleteShare, shareUrl, type Share } from '../../api/client';
import { ConfirmDialog } from './Dialogs';
import dStyles from './Dialogs.module.css';
import styles from './ShareManager.module.css';

type ShareManagerProps = {
  onClose: () => void;
};

export function ShareManager({ onClose }: ShareManagerProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Share | null>(null);

  const loadShares = () => {
    setLoading(true);
    setError(null);
    getShares()
      .then((data) => { setShares(data.shares); setLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : 'Failed to load shares'); setLoading(false); });
  };

  useEffect(() => { loadShares(); }, []);

  const handleDelete = (share: Share) => setPendingDelete(share);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    setDeleting(id);
    try {
      await deleteShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete share');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(shareUrl(token)).catch(() => {});
  };

  return (
    <>
      <Dialog title="Manage Shares" onClose={onClose} width="lg" footer={
        <Button size="compact" onClick={onClose}>Close</Button>
      }>
        {loading ? (
          <div className={styles.shareTable}>
            <div className={styles.shareHeader}>
              <span>Path</span>
              <span>Token</span>
              <span>Expires</span>
              <span>Downloads</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={`${styles.skeletonCell} ${styles.skelW60}`} />
                <div className={`${styles.skeletonCell} ${styles.skelW40}`} />
                <div className={`${styles.skeletonCell} ${styles.skelW50}`} />
                <div className={`${styles.skeletonCell} ${styles.skelW30}`} />
                <div className={`${styles.skeletonCell} ${styles.skelW40}`} />
                <div className={`${styles.skeletonCell} ${styles.skelW50}`} />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className={dStyles.dialogError}>{error} <Button variant="link" onClick={loadShares}>Retry</Button></p>
        ) : shares.length === 0 ? (
          <EmptyState compact title="No shares yet" subtitle="Right-click a file or folder and select Share to create one." />
        ) : (
          <div className={styles.shareTable}>
            <div className={styles.shareHeader}>
              <span>Path</span>
              <span>Token</span>
              <span>Expires</span>
              <span>Downloads</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {shares.map((share) => (
              <div key={share.id} className={styles.shareRow}>
                <span className={styles.shareColPath} data-label="Path" title={share.path}>{share.path}</span>
                <span className={styles.shareColToken} data-label="Token">{share.token.slice(0, 8)}…</span>
                <span className={styles.shareColExpiry} data-label="Expires">
                  {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : 'Never'}
                </span>
                <span className={styles.shareColDownloads} data-label="Downloads">
                  {share.downloadCount}{share.maxDownloads ? ` / ${share.maxDownloads}` : ''}
                </span>
                <span className={styles.shareColEnabled} data-label="Status">
                  <StatusBadge variant={share.enabled ? 'active' : 'disabled'}>
                    {share.enabled ? 'Active' : 'Disabled'}
                  </StatusBadge>
                </span>
                <span className={styles.shareColActions}>
                  <IconButton className={styles.shareActionButton} onClick={() => handleCopyLink(share.token)} title="Copy share link">
                    <Icon name="edit-copy" size={14} />
                  </IconButton>
                  <IconButton className={styles.shareActionButton} onClick={() => handleDelete(share)} disabled={deleting === share.id} title="Delete share">
                    <Icon name="edit-delete" size={14} />
                  </IconButton>
                </span>
              </div>
            ))}
          </div>
        )}
      </Dialog>
      {pendingDelete && (
        <ConfirmDialog
          dialog={{
            title: 'Delete share?',
            message: 'Delete this share link? Anyone with this link will lose access.',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () => { void confirmDelete(); },
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
