import { useMemo, useState } from 'react';
import { Icon, FileIcon } from './Icon';
import { Overlay } from './shared';
import { batchRename } from '../api/client';
import type { FileEntry } from '../api/client';

type PatternType = 'replace' | 'prefix' | 'suffix' | 'case';

type BatchRenameModalProps = {
  entries: FileEntry[];
  onClose: () => void;
  onDone: () => void;
};

export function BatchRenameModal({ entries, onClose, onDone }: BatchRenameModalProps) {
  const [patternType, setPatternType] = useState<PatternType>('replace');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [caseType, setCaseType] = useState<'lower' | 'upper' | 'title'>('lower');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previews = useMemo(() => {
    return entries.map((entry) => {
      const dot = entry.name.lastIndexOf('.');
      const base = dot > 0 ? entry.name.slice(0, dot) : entry.name;
      const ext = dot > 0 ? entry.name.slice(dot) : '';

      let newBase = base;
      switch (patternType) {
        case 'replace':
          newBase = base.split(find).join(replace);
          break;
        case 'prefix':
          newBase = prefix + base;
          break;
        case 'suffix':
          newBase = base + suffix;
          break;
        case 'case':
          if (caseType === 'lower') newBase = base.toLowerCase();
          else if (caseType === 'upper') newBase = base.toUpperCase();
          else newBase = base.replace(/\b\w/g, (c) => c.toUpperCase());
          break;
      }
      return { entry, newName: newBase + ext, changed: newBase + ext !== entry.name };
    });
  }, [entries, patternType, find, replace, prefix, suffix, caseType]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const items = previews.filter((p) => p.changed).map((p) => ({ path: p.entry.path, newName: p.newName }));
      if (items.length === 0) {
        setError('No items will be changed with the current pattern.');
        setSubmitting(false);
        return;
      }
      await batchRename(items);
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch rename failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="rename-modal">
        <div className="panel-header">
          <h3>Batch Rename ({entries.length} items)</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <Icon name="window-close" size={18} />
          </button>
        </div>

        <div className="rename-pattern">
          <select value={patternType} onChange={(e) => setPatternType(e.target.value as PatternType)}>
            <option value="replace">Find & Replace</option>
            <option value="prefix">Add Prefix</option>
            <option value="suffix">Add Suffix</option>
            <option value="case">Change Case</option>
          </select>

          {patternType === 'replace' && (
            <div className="rename-fields">
              <input placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} />
              <Icon name="go-next" size={16} />
              <input placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} />
            </div>
          )}
          {patternType === 'prefix' && (
            <div className="rename-fields">
              <input placeholder="Prefix text" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          )}
          {patternType === 'suffix' && (
            <div className="rename-fields">
              <input placeholder="Suffix text" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
            </div>
          )}
          {patternType === 'case' && (
            <div className="rename-fields">
              <select value={caseType} onChange={(e) => setCaseType(e.target.value as 'lower' | 'upper' | 'title')}>
                <option value="lower">Lowercase</option>
                <option value="upper">Uppercase</option>
                <option value="title">Title Case</option>
              </select>
            </div>
          )}
        </div>

        <div className="rename-preview-list">
          {previews.slice(0, 100).map(({ entry, newName, changed }) => (
            <div key={entry.path} className={`rename-preview-item${changed ? ' changed' : ''}`}>
              <FileIcon entry={entry} size={22} />
              <span className="rename-old">{entry.name}</span>
              <Icon name="go-next" size={14} />
              <span className="rename-new">{newName}</span>
            </div>
          ))}
          {previews.length > 100 && <p className="muted compact">+{previews.length - 100} more items</p>}
        </div>

        {error && <p className="rename-error">{error}</p>}

        <div className="rename-actions">
          <button type="button" className="dialog-button secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="dialog-button primary"
            disabled={submitting || previews.every((p) => !p.changed)}
            onClick={handleSubmit}
          >
            {submitting ? 'Renaming...' : `Rename ${previews.filter((p) => p.changed).length} items`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
