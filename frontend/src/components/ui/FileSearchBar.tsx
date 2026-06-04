import { RefObject } from 'react';
import { Icon, FileIcon } from './Icon';
import { IconButton } from './shared';

import type { SearchResult } from '../../api/client';
import styles from './FileSearchBar.module.css';

type FileSearchBarProps = {
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  onUploadClick: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  canUpload: boolean;
};

export function FileSearchBar({
  query, searchOpen, searchResults, onSearch, onClearSearch, onSearchResultClick,
  onUploadClick, searchRef, canUpload,
}: FileSearchBarProps) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.searchBox}>
        <Icon name="edit-find" size={16} />
        <input
          ref={searchRef as RefObject<HTMLInputElement>}
          placeholder="Search files (Ctrl+K)"
          value={query}
          onFocus={() => { }}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onClearSearch();
            }
          }}
        />
        {query.length > 0 && (
          <button type="button" className={styles.searchClear} onClick={onClearSearch}>
            <Icon name="window-close" size={14} />
          </button>
        )}
      </label>
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
              <FileIcon entry={{ ...result, hidden: false, permissions: '', owner: '', group: '' }} size={20} />
              <span className={styles.searchResultName}>{result.name}</span>
              <span className={styles.searchResultPath}>{result.root}</span>
            </button>
          ))}
        </div>
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
