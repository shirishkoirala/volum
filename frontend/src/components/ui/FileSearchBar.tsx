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
  onRefresh: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onUpload: (files: FileList) => void;
};

export function FileSearchBar({
  query, searchOpen, searchResults, onSearch, onClearSearch, onSearchResultClick,
  onRefresh, isFavorited, onToggleFavorite,
  searchRef, fileInputRef, onUpload,
}: FileSearchBarProps) {
  return (
    <div className={styles.toolbar}>
      <input
        ref={fileInputRef as RefObject<HTMLInputElement>}
        className={styles.hiddenFileInput}
        multiple
        type="file"
        onChange={(event) => {
          if (event.currentTarget.files) {
            onUpload(event.currentTarget.files);
            event.currentTarget.value = '';
          }
        }}
      />
      <label className={styles.searchBox}>
        <Icon name="edit-find" size={16} />
        <input
          ref={searchRef as RefObject<HTMLInputElement>}
          placeholder="Search files (Ctrl+K)"
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
      <IconButton onClick={onRefresh} title="Refresh">
        <Icon name="view-refresh" size={18} />
      </IconButton>
      <IconButton active={isFavorited} onClick={onToggleFavorite} title={isFavorited ? 'Remove from desktop' : 'Add to desktop'}>
        <Icon name="bookmark-new" size={18} />
      </IconButton>
    </div>
  );
}
