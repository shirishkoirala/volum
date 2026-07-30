import type { SearchResult } from '../../api/client-files';
import { FileIcon } from './Icon';
import uiStyles from './shared.module.css';
import styles from './SearchSuggestions.module.css';

type SearchSuggestionsProps = {
  results: SearchResult[] | null;
  loading?: boolean;
  error?: string | null;
  density?: 'default' | 'compact';
  className?: string;
  onSelect: (result: SearchResult) => void;
  onShowAll?: () => void;
};

export function SearchSuggestions({
  results,
  loading = false,
  error = null,
  density = 'default',
  className,
  onSelect,
  onShowAll,
}: SearchSuggestionsProps) {
  const compact = density === 'compact';

  return (
    <div
      className={[styles.dropdown, compact && styles.compact, className].filter(Boolean).join(' ')}
      aria-live="polite"
    >
      {loading ? (
        <div className={styles.state} role="status">
          Searching…
        </div>
      ) : error ? (
        <div className={styles.state} role="alert">
          Search unavailable · {error}
        </div>
      ) : results?.length === 0 ? (
        <div className={styles.state} role="status">
          No files found
        </div>
      ) : (
        results?.map((result) => (
          <button
            key={result.path}
            type="button"
            className={styles.result}
            onClick={() => onSelect(result)}
            aria-label={result.name}
          >
            <FileIcon
              entry={{ ...result, hidden: false, permissions: '', owner: '', group: '' }}
              size={compact ? 16 : 20}
            />
            <span className={styles.name}>{result.name}</span>
            <span className={styles.path}>{result.root}</span>
          </button>
        ))
      )}
      {!loading && !error && results && results.length > 0 && onShowAll && (
        <button
          type="button"
          className={`${uiStyles.dropdownFooterAction} ${styles.footer}`}
          onClick={onShowAll}
        >
          View all {results.length} results &rarr;
        </button>
      )}
    </div>
  );
}
