import { useMemo, useState } from 'react';
import { Icon, FileIcon } from '../ui/Icon';
import { Overlay, PanelHeader } from '../ui/shared';
import { Select } from '../input/Select';
import { batchRename } from '../../api/client';
import type { FileEntry } from '../../api/client';
import styles from './BatchRename.module.css';
import dStyles from './Dialogs.module.css';

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
      <div className={styles.renameModal}>
        <PanelHeader title={`Batch Rename (${entries.length} items)`} onClose={onClose} />

        <div className={styles.renamePattern}>
          <Select value={patternType} onChange={(value) => setPatternType(value as PatternType)}>
            <option value="replace">Find & Replace</option>
            <option value="prefix">Add Prefix</option>
            <option value="suffix">Add Suffix</option>
            <option value="case">Change Case</option>
          </Select>

          {patternType === 'replace' && (
            <div className={styles.renameFields}>
              <input placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} />
              <Icon name="go-next" size={16} />
              <input placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} />
            </div>
          )}
          {patternType === 'prefix' && (
            <div className={styles.renameFields}>
              <input placeholder="Prefix text" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          )}
          {patternType === 'suffix' && (
            <div className={styles.renameFields}>
              <input placeholder="Suffix text" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
            </div>
          )}
          {patternType === 'case' && (
            <div className={styles.renameFields}>
              <Select value={caseType} onChange={(value) => setCaseType(value as 'lower' | 'upper' | 'title')}>
                <option value="lower">Lowercase</option>
                <option value="upper">Uppercase</option>
                <option value="title">Title Case</option>
              </Select>
            </div>
          )}
        </div>

        <div className={styles.renamePreviewList}>
          {previews.slice(0, 100).map(({ entry, newName, changed }) => (
            <div key={entry.path} className={`${styles.renamePreviewItem}${changed ? ` ${styles.changed}` : ''}`}>
              <FileIcon entry={entry} size={22} />
              <span className={styles.renameOld}>{entry.name}</span>
              <Icon name="go-next" size={14} />
              <span className={styles.renameNew}>{newName}</span>
            </div>
          ))}
          {previews.length > 100 && <p className="muted compact">+{previews.length - 100} more items</p>}
        </div>

        {error && <p className={styles.renameError}>{error}</p>}

        <div className={styles.renameActions}>
          <button type="button" className={`${dStyles.dialogButton} ${dStyles.secondary}`} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`${dStyles.dialogButton} ${dStyles.primary}`}
            disabled={submitting || previews.every((p) => !p.changed)}
            onClick={handleSubmit}
          >
            {submitting ? <><Icon name="view-refresh" size={15} /> Renaming...</> : `Rename ${previews.filter((p) => p.changed).length} items`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
