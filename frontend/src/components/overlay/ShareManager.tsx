import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton, StatusBadge } from '../ui/shared';
import { Dialog } from './Dialog';
import { EmptyState } from '../ui/EmptyState';
import { ErrorBanner } from '../ui/ErrorBanner';
import { InlineFeedback } from '../ui/InlineFeedback';
import { shareUrl } from '../../api/client-base';
import { getShares, deleteShare, type Share } from '../../api/client-shares';
import { ConfirmDialog } from './ConfirmDialog';
import { Skeleton } from '../ui/Skeleton';
import { useAsyncData } from '../../hooks/useAsyncData';
import styles from './ShareManager.module.css';

type ShareManagerProps = {
  onClose: () => void;
};

export function ShareManager({ onClose }: ShareManagerProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Share | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<{
    result: 'copied' | 'failed';
    url: string;
  } | null>(null);

  const { data: sharesData, loading, error, refresh: loadShares } = useAsyncData(() => getShares());

  useEffect(() => {
    if (sharesData) setShares(sharesData.shares);
  }, [sharesData]);

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
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete share');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyLink = async (token: string) => {
    setCopyStatus(null);
    const url = shareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus({ result: 'copied', url });
    } catch {
      setCopyStatus({ result: 'failed', url });
    }
  };

  return (
    <>
      <Dialog
        title="Manage Shares"
        onClose={onClose}
        width="lg"
        footer={
          <Button size="compact" onClick={onClose}>
            Close
          </Button>
        }
      >
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
            <Skeleton variant="row" count={3} />
          </div>
        ) : error || deleteError ? (
          <ErrorBanner
            message={error || deleteError || ''}
            onRetry={() => {
              loadShares();
              setDeleteError(null);
            }}
          />
        ) : shares.length === 0 ? (
          <EmptyState
            compact
            title="No shares yet"
            subtitle="Right-click a file or folder and select Share to create one."
          />
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
                <span className={styles.shareColPath} data-label="Path" title={share.path}>
                  {share.path}
                </span>
                <span className={styles.shareColToken} data-label="Token">
                  {share.token.slice(0, 8)}…
                </span>
                <span className={styles.shareColExpiry} data-label="Expires">
                  {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : 'Never'}
                </span>
                <span className={styles.shareColDownloads} data-label="Downloads">
                  {share.downloadCount}
                  {share.maxDownloads ? ` / ${share.maxDownloads}` : ''}
                </span>
                <span className={styles.shareColEnabled} data-label="Status">
                  <StatusBadge variant={share.enabled ? 'active' : 'disabled'}>
                    {share.enabled ? 'Active' : 'Disabled'}
                  </StatusBadge>
                </span>
                <span className={styles.shareColActions}>
                  <IconButton
                    className={styles.shareActionButton}
                    onClick={() => void handleCopyLink(share.token)}
                    title="Copy share link"
                  >
                    <Icon name="edit-copy" size={14} />
                  </IconButton>
                  <IconButton
                    className={styles.shareActionButton}
                    onClick={() => handleDelete(share)}
                    disabled={deleting === share.id}
                    title="Delete share"
                  >
                    <Icon name="edit-delete" size={14} />
                  </IconButton>
                </span>
              </div>
            ))}
          </div>
        )}
        {copyStatus && (
          <InlineFeedback
            variant={copyStatus.result === 'copied' ? 'success' : 'error'}
            className={styles.copyFeedback}
          >
            {copyStatus.result === 'copied' ? (
              'Share link copied to clipboard.'
            ) : (
              <>
                The browser could not copy the link. Copy it manually: <code>{copyStatus.url}</code>
              </>
            )}
          </InlineFeedback>
        )}
      </Dialog>
      {pendingDelete && (
        <ConfirmDialog
          dialog={{
            title: 'Delete share?',
            message: 'Delete this share link? Anyone with this link will lose access.',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () => {
              void confirmDelete();
            },
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
