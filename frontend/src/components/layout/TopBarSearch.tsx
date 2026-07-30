import { type RefObject, useRef } from 'react';
import { Icon, FileIcon } from '../ui/Icon';
import type { SearchResult } from '../../api/client-files';
import styles from './TopBarSearch.module.css';

type TopBarSearchProps = {
  expanded: boolean;
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  searchLoading: boolean;
  searchError: string | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  onShowAllResults?: (query: string) => void;
  onExpand: () => void;
  onCollapse: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
};

export function TopBarSearch({
  expanded,
  query,
  searchOpen,
  searchResults,
  searchLoading,
  searchError,
  onSearch,
  onClearSearch,
  onSearchResultClick,
  onShowAllResults,
  onExpand,
  onCollapse,
  searchRef,
}: TopBarSearchProps) {
  const collapsedButtonRef = useRef<HTMLButtonElement>(null);

  const collapseAndRestoreFocus = () => {
    onClearSearch();
    onCollapse();
    requestAnimationFrame(() => collapsedButtonRef.current?.focus());
  };

  if (!expanded) {
    return (
      <button
        ref={collapsedButtonRef}
        type="button"
        className={styles.searchButton}
        onClick={onExpand}
        title="Search"
        aria-label="Search"
      >
        <Icon name="edit-find" size={16} />
      </button>
    );
  }

  return (
    <div
      className={styles.searchBox}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        collapseAndRestoreFocus();
      }}
    >
      <Icon name="edit-find" size={14} />
      <input
        ref={searchRef as RefObject<HTMLInputElement>}
        aria-label="Search files"
        data-control="embedded"
        placeholder="Search everywhere…"
        value={query}
        onChange={(event) => onSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && query.trim() && onShowAllResults) onShowAllResults(query);
        }}
      />
      <button
        type="button"
        className={styles.searchClear}
        onClick={collapseAndRestoreFocus}
        aria-label="Close search"
      >
        <Icon name="window-close" size={13} />
      </button>
      {searchOpen && query.trim().length >= 2 && (
        <div className={styles.searchResultsDropdown} aria-live="polite">
          {searchLoading ? (
            <div className={styles.searchState} role="status">
              Searching…
            </div>
          ) : searchError ? (
            <div className={styles.searchState} role="alert">
              Search unavailable · {searchError}
            </div>
          ) : searchResults?.length === 0 ? (
            <div className={styles.searchState} role="status">
              No files found
            </div>
          ) : (
            searchResults?.map((result) => (
              <button
                key={result.path}
                type="button"
                className={styles.searchResultItem}
                onClick={() => onSearchResultClick(result)}
                aria-label={result.name}
              >
                <FileIcon
                  entry={{ ...result, hidden: false, permissions: '', owner: '', group: '' }}
                  size={16}
                />
                <span className={styles.searchResultName}>{result.name}</span>
                <span className={styles.searchResultPath}>{result.root}</span>
              </button>
            ))
          )}
          {!searchLoading &&
            !searchError &&
            searchResults &&
            searchResults.length > 0 &&
            onShowAllResults && (
              <button
                type="button"
                className={styles.showAllResults}
                onClick={() => onShowAllResults(query)}
              >
                View all {searchResults.length} results &rarr;
              </button>
            )}
        </div>
      )}
    </div>
  );
}
