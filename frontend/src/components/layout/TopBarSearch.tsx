import { type RefObject, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { SearchSuggestions } from '../ui/SearchSuggestions';
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
        <SearchSuggestions
          className={styles.searchResultsDropdown}
          density="compact"
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          onSelect={onSearchResultClick}
          onShowAll={onShowAllResults ? () => onShowAllResults(query) : undefined}
        />
      )}
    </div>
  );
}
