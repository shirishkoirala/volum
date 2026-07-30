import { useMemo, useState } from 'react';
import { Icon, FileIcon } from '../ui/Icon';
import { Button, MutedText } from '../ui/shared';
import { Dialog } from './Dialog';
import { Select } from '../input/Select';
import { batchRename } from '../../api/client-files';
import type { FileEntry } from '../../api/client-files';
import uiStyles from '../ui/shared.module.css';
import styles from './BatchRename.module.css';

type PatternType = 'replace' | 'prefix' | 'suffix' | 'case';

type BatchRenameModalProps = {
  entries: FileEntry[];
  onClose: () => void;
  onDone: (renamed: number, failed: number) => void;
};

export function BatchRenameModal({ entries, onClose, onDone }: BatchRenameModalProps) {
  const [patternType, setPatternType] = useState<PatternType>('replace');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [caseType, setCaseType] = useState<'lower' | 'upper' | 'title'>('lower');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    renamed: number;
    attempted: number;
    errors: { path: string; error: string }[];
  } | null>(null);
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
      const items = previews
        .filter((p) => p.changed)
        .map((p) => ({ path: p.entry.path, newName: p.newName }));
      if (items.length === 0) {
        setError('No items will be changed with the current pattern.');
        setSubmitting(false);
        return;
      }
      const result = await batchRename(items);
      const failures = result?.errors ?? [];
      const renamed = result?.complete ?? items.length - failures.length;
      onDone(renamed, failures.length);
      if (failures.length > 0) {
        setSummary({ renamed, attempted: items.length, errors: failures });
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch rename failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      title={`Batch Rename (${entries.length} items)`}
      onClose={onClose}
      width="lg"
      footer={
        summary ? (
          <Button size="compact" variant="primary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button size="compact" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="compact"
              variant="primary"
              disabled={submitting || previews.every((p) => !p.changed)}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Icon name="view-refresh" size={15} className={uiStyles.spin} /> Renaming...
                </>
              ) : (
                `Rename ${previews.filter((p) => p.changed).length} items`
              )}
            </Button>
          </>
        )
      }
    >
      <div className={styles.renamePattern}>
        <span className={styles.fieldLabel}>Rename rule</span>
        <Select value={patternType} onChange={(value) => setPatternType(value as PatternType)}>
          <option value="replace">Find & Replace</option>
          <option value="prefix">Add Prefix</option>
          <option value="suffix">Add Suffix</option>
          <option value="case">Change Case</option>
        </Select>

        {patternType === 'replace' && (
          <div className={styles.renameFields}>
            <label className={styles.renameField}>
              <span>Find</span>
              <input value={find} onChange={(e) => setFind(e.target.value)} />
            </label>
            <Icon name="go-next" size={16} />
            <label className={styles.renameField}>
              <span>Replace with</span>
              <input value={replace} onChange={(e) => setReplace(e.target.value)} />
            </label>
          </div>
        )}
        {patternType === 'prefix' && (
          <div className={styles.renameFields}>
            <label className={styles.renameField}>
              <span>Prefix text</span>
              <input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </label>
          </div>
        )}
        {patternType === 'suffix' && (
          <div className={styles.renameFields}>
            <label className={styles.renameField}>
              <span>Suffix text</span>
              <input value={suffix} onChange={(e) => setSuffix(e.target.value)} />
            </label>
          </div>
        )}
        {patternType === 'case' && (
          <div className={styles.renameFields}>
            <span className={styles.fieldLabel}>Letter case</span>
            <Select
              value={caseType}
              onChange={(value) => setCaseType(value as 'lower' | 'upper' | 'title')}
            >
              <option value="lower">Lowercase</option>
              <option value="upper">Uppercase</option>
              <option value="title">Title Case</option>
            </Select>
          </div>
        )}
      </div>

      <div className={styles.renamePreviewList}>
        {previews.slice(0, 100).map(({ entry, newName, changed }) => (
          <div
            key={entry.path}
            className={`${styles.renamePreviewItem}${changed ? ` ${styles.changed}` : ''}`}
          >
            <FileIcon entry={entry} size={22} />
            <span className={styles.renameOld}>{entry.name}</span>
            <Icon name="go-next" size={14} />
            <span className={styles.renameNew}>{newName}</span>
          </div>
        ))}
        {previews.length > 100 && (
          <p>
            <MutedText compact>+{previews.length - 100} more items</MutedText>
          </p>
        )}
      </div>

      {error && (
        <p className={styles.renameError} role="alert">
          {error}
        </p>
      )}
      {summary && (
        <div className={styles.renameSummary} role="alert">
          <strong>
            Renamed {summary.renamed} of {summary.attempted} items. {summary.errors.length} failed.
          </strong>
          <ul>
            {summary.errors.map((failure) => (
              <li key={failure.path}>
                <span>{failure.path}</span>: {failure.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
