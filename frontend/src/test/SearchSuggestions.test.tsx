import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchSuggestions } from '../components/ui/SearchSuggestions';

const result = {
  name: 'report.txt',
  path: '/storage/report.txt',
  type: 'file' as const,
  size: 42,
  modifiedAt: '2026-01-01T00:00:00Z',
  root: '/storage',
};

describe('SearchSuggestions', () => {
  it('selects a result and opens the full result set', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onShowAll = vi.fn();
    render(<SearchSuggestions results={[result]} onSelect={onSelect} onShowAll={onShowAll} />);

    await user.click(screen.getByRole('button', { name: 'report.txt' }));
    await user.click(screen.getByRole('button', { name: 'View all 1 results →' }));

    expect(onSelect).toHaveBeenCalledWith(result);
    expect(onShowAll).toHaveBeenCalledOnce();
  });

  it('announces loading, errors, and empty results', () => {
    const { rerender } = render(<SearchSuggestions results={null} loading onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Searching…');

    rerender(<SearchSuggestions results={null} error="Offline" onSelect={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Search unavailable · Offline');

    rerender(<SearchSuggestions results={[]} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('No files found');
  });
});
