import { RefObject } from 'react';
import { Icon } from './Icon';
import { SearchSuggestions } from './SearchSuggestions';
import { IconButton } from './shared';

import type { SearchResult } from '../../api/client-files';
import styles from './FileSearchBar.module.css';

type FileSearchBarProps = {
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  onUploadClick: () => void;
  onShowAllResults?: (query: string) => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  canUpload: boolean;
};

export function FileSearchBar({
  query,
  searchOpen,
  searchResults,
  onSearch,
  onClearSearch,
  onSearchResultClick,
  onUploadClick,
  onShowAllResults,
  searchRef,
  canUpload,
}: FileSearchBarProps) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.searchBox}>
        <Icon name="edit-find" size={16} />
        <input
          ref={searchRef as RefObject<HTMLInputElement>}
          data-control="embedded"
          aria-label="Search files"
          placeholder="Search files"
          value={query}
          onFocus={() => {}}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onClearSearch();
            }
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={onClearSearch}
            aria-label="Clear search"
          >
            <Icon name="window-close" size={14} />
          </button>
        )}
      </label>
      {searchOpen && searchResults && searchResults.length > 0 && (
        <SearchSuggestions
          className={styles.searchResultsDropdown}
          results={searchResults}
          onSelect={onSearchResultClick}
          onShowAll={onShowAllResults ? () => onShowAllResults(query) : undefined}
        />
      )}
      <IconButton
        disabled={!canUpload}
        onClick={onUploadClick}
        title={canUpload ? 'Upload' : 'Open a writable folder to upload'}
        aria-label="Upload"
      >
        <Icon name="document-import" size={18} />
      </IconButton>
    </div>
  );
}
