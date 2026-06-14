import { useEffect, useState } from 'react';
import { getJobConflicts } from '../../api/client';
import type { ConflictItem } from '../../api/client';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/shared';
import { Overlay } from '../ui/shared';
import { formatBytes } from '../../utils/format';
import styles from './ConflictDialog.module.css';

type ConflictResolution = 'skip' | 'overwrite' | 'rename';

type Props = {
  jobId: string;
  onResolve: (
    items: Array<{ itemId: string; resolution: ConflictResolution }>,
    defaultResolution?: ConflictResolution,
  ) => void;
  onClose: () => void;
};

export function ConflictDialog({ jobId, onResolve, onClose }: Props) {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [defaultResolution, setDefaultResolution] = useState<ConflictResolution | null>(null);

  useEffect(() => {
    getJobConflicts(jobId)
      .then((r) => {
        setConflicts(r.items ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setErrMsg(err instanceof Error ? err.message : 'Failed to load conflicts');
        setLoading(false);
      });
  }, [jobId]);

  const setItemResolution = (itemId: string, resolution: ConflictResolution) => {
    setResolutions((prev) => ({ ...prev, [itemId]: resolution }));
  };

  const handleSubmit = () => {
    const items = conflicts
      .filter((c) => resolutions[c.id])
      .map((c) => ({ itemId: c.id, resolution: resolutions[c.id]! }));
    onResolve(items, defaultResolution ?? undefined);
  };

  const allResolved = conflicts.every((c) => resolutions[c.id]);

  return (
    <Overlay onClose={onClose} zIndex={600}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3>Resolve Conflicts</h3>
          <p className={styles.subtitle}>
            Choose how to handle each conflicting file
          </p>
        </div>

        {loading && <p className={styles.loading}>Loading conflicts&hellip;</p>}
        {errMsg && <p className={styles.error}>{errMsg}</p>}

        {!loading && !errMsg && conflicts.length === 0 && (
          <p className={styles.empty}>No conflicting files found.</p>
        )}

        {!loading && !errMsg && conflicts.length > 0 && (
          <>
            <div className={styles.defaultRow}>
              <label className={styles.defaultLabel}>Apply to all:</label>
              <select
                className={styles.select}
                value={defaultResolution ?? ''}
                onChange={(e) => {
                  const val = e.target.value as ConflictResolution | '';
                  setDefaultResolution(val || null);
                }}
              >
                <option value="">&mdash; choose &mdash;</option>
                <option value="skip">Skip all</option>
                <option value="overwrite">Overwrite all</option>
                <option value="rename">Rename all</option>
              </select>
              {defaultResolution && (
                <Button size="compact" onClick={() => {
                  const all: Record<string, ConflictResolution> = {};
                  for (const c of conflicts) all[c.id] = defaultResolution;
                  setResolutions(all);
                }}>
                  Apply
                </Button>
              )}
            </div>

            <div className={styles.list}>
              {conflicts.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <Icon name="dialog-warning" size={16} />
                    <div className={styles.itemPaths}>
                      <span className={styles.itemSource}>{item.sourcePath}</span>
                      <span className={styles.itemDest} title={item.destinationPath}>
                        &rarr; {item.destinationPath}
                      </span>
                      {item.sizeBytes > 0 && (
                        <span className={styles.itemSize}>{formatBytes(item.sizeBytes)}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    {(['skip', 'overwrite', 'rename'] as const).map((r) => (
                      <button
                        key={r}
                        className={`${styles.choiceBtn} ${resolutions[item.id] === r ? styles.choiceBtnActive : ''}`}
                        onClick={() => setItemResolution(item.id, r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.footer}>
          <Button size="compact" onClick={onClose}>Cancel</Button>
          <Button
            size="compact"
            variant="primary"
            onClick={handleSubmit}
            disabled={!allResolved || conflicts.length === 0}
          >
            {allResolved ? 'Resolve & Resume' : 'Resolve each file above'}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
