import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from '../components/layout/TopBar';
import { buildJob } from './fixtures';

describe('TopBar', () => {
  it('closes Activity on Escape and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    const clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);

    try {
      render(
        <TopBar
          activeView="desktop"
          onGoDesktop={vi.fn()}
          searchQuery=""
          searchOpen={false}
          searchResults={null}
          searchLoading={false}
          searchError={null}
          onSearch={vi.fn()}
          onClearSearch={vi.fn()}
          onSearchResultClick={vi.fn()}
          onShowAllSearchResults={vi.fn()}
          theme="light"
          onToggleTheme={vi.fn()}
          jobs={[buildJob()]}
          onOpenJobs={vi.fn()}
        />,
      );

      const activityButton = screen.getByRole('button', { name: 'Activity' });
      await user.click(activityButton);
      const viewAll = screen.getByRole('button', { name: /View all jobs/ });
      viewAll.focus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('button', { name: /View all jobs/ })).not.toBeInTheDocument();
      await waitFor(() => expect(activityButton).toHaveFocus());
    } finally {
      clientWidth.mockRestore();
      offsetWidth.mockRestore();
      scrollWidth.mockRestore();
    }
  });
});
