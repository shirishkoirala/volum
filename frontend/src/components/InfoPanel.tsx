import { useState } from 'react';
import { Icon, FileIcon } from './Icon';
import { chmodPath } from '../api/client';
import type { FileEntry } from '../api/client';

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
  return bits.map((b) => (b ? ['r', 'w', 'x'][bits.indexOf(b) % 3] : '-')).join('');
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
    <div className="preview-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="info-panel">
        <div className="info-panel-header">
          <h3>Info</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <Icon name="window-close" size={18} />
          </button>
        </div>

        <div className="info-panel-body">
          <div className="info-icon-row">
            <FileIcon entry={entry} size={48} />
            <div>
              <strong>{entry.name}</strong>
              <span className="muted">{entry.type === 'directory' ? 'Directory' : 'File'}</span>
            </div>
          </div>

          <dl className="info-dl">
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
          <div className="perm-grid">
            <span className="perm-group-label"/>
            <span className="perm-col-label">Read</span>
            <span className="perm-col-label">Write</span>
            <span className="perm-col-label">Execute</span>
            <span className="perm-group-label">Owner</span>
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                className={`perm-toggle${permBits[i] ? ' on' : ''}`}
                onClick={() => toggleBit(i)}
              >
                {permBits[i] ? PERM_BITS[i].bit : '-'}
              </button>
            ))}
            <span className="perm-group-label">Group</span>
            {[3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                className={`perm-toggle${permBits[i] ? ' on' : ''}`}
                onClick={() => toggleBit(i)}
              >
                {permBits[i] ? PERM_BITS[i].bit : '-'}
              </button>
            ))}
            <span className="perm-group-label">Other</span>
            {[6, 7, 8].map((i) => (
              <button
                key={i}
                type="button"
                className={`perm-toggle${permBits[i] ? ' on' : ''}`}
                onClick={() => toggleBit(i)}
              >
                {permBits[i] ? PERM_BITS[i].bit : '-'}
              </button>
            ))}
          </div>
          <div className="perm-preview">{permString}</div>

          {error && <p className="info-error">{error}</p>}
          {saved && <p className="info-saved">Permissions updated</p>}

          <div className="info-actions">
            <button type="button" onClick={onClose}>Close</button>
            <button
              type="button"
              className="info-apply"
              disabled={changing || saved || permString === entry.permissions}
              onClick={handleSave}
            >
              {changing ? 'Saving...' : 'Apply Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
