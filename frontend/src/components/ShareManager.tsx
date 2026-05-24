import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Overlay } from './shared';
import { EmptyState } from './EmptyState';
import { getShares, deleteShare, type Share } from '../api/client';
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

  const loadShares = () => {
    setLoading(true);
    setError(null);
    getShares()
      .then((data) => {
        setShares(data.shares);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load shares');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadShares();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this share link? Anyone with this link will lose access.')) return;
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
    const url = `${window.location.origin}/api/public/${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  return (
    <Overlay zIndex={110} onClose={onClose}>
      <div className={`${dStyles.appDialog} ${styles.shareManager}`} role="dialog" aria-modal="true">
        <div className="panel-header">
          <h3>Manage Shares</h3>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <Icon name="window-close" size={18} />
          </button>
        </div>

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
                <div className={styles.skeletonCell} style={{ width: '60%' }} />
                <div className={styles.skeletonCell} style={{ width: '40%' }} />
                <div className={styles.skeletonCell} style={{ width: '50%' }} />
                <div className={styles.skeletonCell} style={{ width: '30%' }} />
                <div className={styles.skeletonCell} style={{ width: '40%' }} />
                <div className={styles.skeletonCell} style={{ width: '50%' }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className={dStyles.dialogError}>{error} <button type="button" className={styles.retryBtn} onClick={loadShares}>Retry</button></p>
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
                <span className={styles.shareColPath} title={share.path}>{share.path}</span>
                <span className={styles.shareColToken}>{share.token.slice(0, 8)}…</span>
                <span className={styles.shareColExpiry}>
                  {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : 'Never'}
                </span>
                <span className={styles.shareColDownloads}>
                  {share.downloadCount}{share.maxDownloads ? ` / ${share.maxDownloads}` : ''}
                </span>
                <span className={styles.shareColEnabled}>
                  <span className={share.enabled ? styles.statusActive : styles.statusDisabled}>
                    {share.enabled ? 'Active' : 'Disabled'}
                  </span>
                </span>
                <span className={styles.shareColActions}>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleCopyLink(share.token)}
                    title="Copy share link"
                  >
                    <Icon name="edit-copy" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleDelete(share.id)}
                    disabled={deleting === share.id}
                    title="Delete share"
                  >
                    <Icon name="edit-delete" size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={dStyles.dialogActions}>
          <button type="button" className={`${dStyles.dialogButton} ${dStyles.secondary}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}
