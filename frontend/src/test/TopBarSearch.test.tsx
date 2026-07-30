import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBarSearch } from '../components/layout/TopBarSearch';

describe('TopBarSearch', () => {
  it('closes from a result on Escape and restores focus to Search', async () => {
    const user = userEvent.setup();
    const onClearSearch = vi.fn();

    function SearchHarness() {
      const [expanded, setExpanded] = useState(true);
      return (
        <TopBarSearch
          expanded={expanded}
          query="report"
          searchOpen
          searchResults={[
            {
              name: 'report.txt',
              path: '/storage/report.txt',
              type: 'file',
              size: 42,
              modifiedAt: '2026-01-01T00:00:00Z',
              root: '/storage',
            },
          ]}
          searchLoading={false}
          searchError={null}
          onSearch={vi.fn()}
          onClearSearch={onClearSearch}
          onSearchResultClick={vi.fn()}
          onShowAllResults={vi.fn()}
          onExpand={() => setExpanded(true)}
          onCollapse={() => setExpanded(false)}
        />
      );
    }

    render(<SearchHarness />);
    screen.getByRole('button', { name: 'report.txt' }).focus();
    await user.keyboard('{Escape}');

    const searchButton = await screen.findByRole('button', { name: 'Search' });
    await waitFor(() => expect(searchButton).toHaveFocus());
    expect(onClearSearch).toHaveBeenCalledOnce();
  });
});
