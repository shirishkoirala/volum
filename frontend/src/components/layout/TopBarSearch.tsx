import { RefObject } from 'react';
import { Icon, FileIcon } from '../ui/Icon';
import type { SearchResult } from '../../api/client';
import styles from './TopBarSearch.module.css';

type TopBarSearchProps = {
  expanded: boolean;
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
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
  onSearch,
  onClearSearch,
  onSearchResultClick,
  onShowAllResults,
  onExpand,
  onCollapse,
  searchRef,
}: TopBarSearchProps) {
  if (!expanded) {
    return (
      <button
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
    <label className={styles.searchBox}>
      <Icon name="edit-find" size={14} />
      <input
        ref={searchRef as RefObject<HTMLInputElement>}
        aria-label="Search files"
        data-control="embedded"
        placeholder="Search everywhere…"
        value={query}
        onChange={(event) => onSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClearSearch();
            onCollapse();
          }
          if (event.key === 'Enter' && query.trim() && onShowAllResults) onShowAllResults(query);
        }}
      />
      <button
        type="button"
        className={styles.searchClear}
        onClick={() => {
          onClearSearch();
          onCollapse();
        }}
        aria-label="Close search"
      >
        <Icon name="window-close" size={13} />
      </button>
      {searchOpen && searchResults && searchResults.length > 0 && (
        <div className={styles.searchResultsDropdown}>
          {searchResults.map((result) => (
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
          ))}
          {onShowAllResults && (
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
    </label>
  );
}
