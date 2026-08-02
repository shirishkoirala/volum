import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchResultsView } from '../pages/SearchResultsView';
import { buildSession } from './fixtures';

const api = vi.hoisted(() => ({
  searchFiles: vi.fn(),
}));

vi.mock('../api/client-files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client-files')>();
  return { ...actual, searchFiles: api.searchFiles };
});

function result(name: string) {
  return {
    name,
    path: `/storage/${name}`,
    type: 'file' as const,
    size: 10,
    modifiedAt: '2026-07-30T00:00:00Z',
    root: '/storage',
  };
}

describe('SearchResultsView', () => {
  beforeEach(() => {
    api.searchFiles.mockReset();
  });

  it('ignores a slower response for an older query', async () => {
    let resolveOld: ((value: { results: ReturnType<typeof result>[] }) => void) | undefined;
    const oldRequest = new Promise<{ results: ReturnType<typeof result>[] }>((resolve) => {
      resolveOld = resolve;
    });
    api.searchFiles.mockImplementation((query: string) =>
      query === 'older' ? oldRequest : Promise.resolve({ results: [result('newer-result.png')] }),
    );
    render(
      <SearchResultsView
        initialQuery="older"
        session={buildSession()}
        onNavigate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(api.searchFiles).toHaveBeenCalledWith('older', 100));
    fireEvent.change(screen.getByLabelText('Search files across all roots'), {
      target: { value: 'newer' },
    });
    expect(await screen.findByText('newer-result.png')).toBeInTheDocument();

    await act(async () => resolveOld?.({ results: [result('older-result.png')] }));
    expect(screen.queryByText('older-result.png')).not.toBeInTheDocument();
    expect(screen.getByText('newer-result.png')).toBeInTheDocument();
  });

  it('does not expose sharing from a read-only preview', async () => {
    api.searchFiles.mockResolvedValue({ results: [result('photo.png')] });
    const user = userEvent.setup();
    render(
      <SearchResultsView
        initialQuery="photo"
        session={buildSession({ role: 'readonly' })}
        onNavigate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(await screen.findByText('photo.png'));
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.queryByTitle('Share')).not.toBeInTheDocument();
  });
});
