import { useState } from 'react';
import { Icon, FileIcon } from '../ui/Icon';
import { Overlay } from '../ui/shared';
import { chmodPath } from '../../api/client';
import type { FileEntry } from '../../api/client';
import styles from './InfoPanel.module.css';

type InfoPanelProps = {
  entry: FileEntry;
  onClose: () => void;
  onRefresh: () => void;
};

const PERM_BITS = [
  { label: 'Owner Read', bit: 'r', pos: 0 },
  { label: 'Owner Write', bit: 'w', pos: 1 },
  { label: 'Owner Execute', bit: 'x', pos: 2 },
  { label: 'Group Read', bit: 'r', pos: 3 },
  { label: 'Group Write', bit: 'w', pos: 4 },
  { label: 'Group Execute', bit: 'x', pos: 5 },
  { label: 'Other Read', bit: 'r', pos: 6 },
  { label: 'Other Write', bit: 'w', pos: 7 },
  { label: 'Other Execute', bit: 'x', pos: 8 },
];

function parsePermString(perm: string): boolean[] {
  const bits = new Array(9).fill(false);
  for (let i = 0; i < 9 && i < perm.length; i++) {
    bits[i] = perm[i] !== '-';
  }
  return bits;
}

function formatPermBits(bits: boolean[]): string {
  return bits.map((b, i) => (b ? ['r', 'w', 'x'][i % 3] : '-')).join('');
}

export function InfoPanel({ entry, onClose, onRefresh }: InfoPanelProps) {
  const [permBits, setPermBits] = useState(() => parsePermString(entry.permissions));
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const permString = formatPermBits(permBits);

  const toggleBit = (pos: number) => {
    const next = [...permBits];
    next[pos] = !next[pos];
    setPermBits(next);
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    setChanging(true);
    setError(null);
    try {
      const result = await chmodPath(entry.path, permString);
      setPermBits(parsePermString(result.permissions));
      setSaved(true);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change permissions');
    } finally {
      setChanging(false);
    }
  };

  const sizeStr = entry.size === 0 ? '0 B' : (() => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(entry.size) / Math.log(1024)), units.length - 1);
    return `${(entry.size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  })();

  return (
    <Overlay onClose={onClose}>
      <div className={styles.infoPanel}>
        <div className="panel-header">
          <h3>Info</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <Icon name="window-close" size={18} />
          </button>
        </div>

        <div className={styles.infoPanelBody}>
          <div className={styles.infoIconRow}>
            <FileIcon entry={entry} size={48} />
            <div>
              <strong>{entry.name}</strong>
              <span className="muted">{entry.type === 'directory' ? 'Directory' : 'File'}</span>
            </div>
          </div>

          <dl className={styles.infoDl}>
            <dt>Path</dt>
            <dd>{entry.path}</dd>
            <dt>Size</dt>
            <dd>{sizeStr}</dd>
            <dt>Modified</dt>
            <dd>{new Date(entry.modifiedAt).toLocaleString()}</dd>
            <dt>Owner</dt>
            <dd>{entry.owner || '—'}</dd>
            <dt>Group</dt>
            <dd>{entry.group || '—'}</dd>
          </dl>

          <h4>Permissions</h4>
          <div className={styles.permGrid}>
            <span className={styles.permGroupLabel}/>
            <span className={styles.permColLabel}>Read</span>
            <span className={styles.permColLabel}>Write</span>
            <span className={styles.permColLabel}>Execute</span>
            <span className={styles.permGroupLabel}>Owner</span>
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                className={`${styles.permToggle}${permBits[i] ? ` ${styles.on}` : ''}`}
                onClick={() => toggleBit(i)}
              >
                {permBits[i] ? PERM_BITS[i].bit : '-'}
              </button>
            ))}
            <span className={styles.permGroupLabel}>Group</span>
            {[3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                className={`${styles.permToggle}${permBits[i] ? ` ${styles.on}` : ''}`}
                onClick={() => toggleBit(i)}
              >
                {permBits[i] ? PERM_BITS[i].bit : '-'}
              </button>
            ))}
            <span className={styles.permGroupLabel}>Other</span>
            {[6, 7, 8].map((i) => (
              <button
                key={i}
                type="button"
                className={`${styles.permToggle}${permBits[i] ? ` ${styles.on}` : ''}`}
                onClick={() => toggleBit(i)}
              >
                {permBits[i] ? PERM_BITS[i].bit : '-'}
              </button>
            ))}
          </div>
          <div className={styles.permPreview}>{permString}</div>

          {error && <p className={styles.infoError}>{error}</p>}
          {saved && <p className={styles.infoSaved}>Permissions updated</p>}

          <div className={styles.infoActions}>
            <button type="button" onClick={onClose}>Close</button>
            <button
              type="button"
              className={styles.infoApply}
              disabled={changing || saved || permString === entry.permissions}
              onClick={handleSave}
            >
              {changing ? <><Icon name="view-refresh" size={15} /> Saving...</> : 'Apply Permissions'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
