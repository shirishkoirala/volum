import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchRenameModal } from '../components/overlay/BatchRenameModal';
import { batchRename } from '../api/client-files';
import { buildFileEntry } from './fixtures';

vi.mock('../api/client-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client-files')>()),
  batchRename: vi.fn(),
}));

describe('BatchRenameModal', () => {
  it('keeps partial failures visible with an accurate summary', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDone = vi.fn();
    vi.mocked(batchRename).mockResolvedValue({
      complete: 1,
      errors: [{ path: '/storage/b.txt', error: 'name already exists' }],
    });

    render(
      <BatchRenameModal
        entries={[
          buildFileEntry({ name: 'a.txt', path: '/storage/a.txt' }),
          buildFileEntry({ name: 'b.txt', path: '/storage/b.txt' }),
        ]}
        onClose={onClose}
        onDone={onDone}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'prefix');
    await user.type(screen.getByRole('textbox', { name: 'Prefix text' }), 'new-');
    await user.click(screen.getByRole('button', { name: 'Rename 2 items' }));

    expect(await screen.findByText('Renamed 1 of 2 items. 1 failed.')).toBeInTheDocument();
    expect(screen.getByText('/storage/b.txt')).toBeInTheDocument();
    expect(screen.getByText(/name already exists/)).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(1, 1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
