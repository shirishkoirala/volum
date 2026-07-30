import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenuShell } from '../components/overlay/ContextMenuShell';
import { FileContextMenu } from '../components/overlay/FileContextMenu';

function ContextMenuHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open menu
      </button>
      <button type="button">After menu</button>
      {open && (
        <ContextMenuShell x={20} y={20} onClose={() => setOpen(false)}>
          <button type="button" role="menuitem">
            Rename
          </button>
          <button type="button" role="menuitem">
            Delete
          </button>
        </ContextMenuShell>
      )}
    </>
  );
}

describe('ContextMenuShell', () => {
  it('focuses its first action and restores the opener on Escape', async () => {
    const user = userEvent.setup();
    render(<ContextMenuHarness />);

    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps read-only file actions non-mutating', () => {
    const noop = vi.fn();
    render(
      <FileContextMenu
        x={20}
        y={20}
        caps={{
          canWrite: false,
          canPreview: true,
          canInfo: true,
          canDownload: true,
          canRename: true,
          canArchive: true,
          canExtract: false,
          canChecksum: false,
          canCopy: true,
          canMove: true,
          canPaste: false,
          canDelete: true,
        }}
        isFavorited={false}
        selectedCount={1}
        onPreview={noop}
        onShowInfo={noop}
        onDownload={noop}
        onRename={noop}
        onBatchRename={noop}
        onCopy={noop}
        onMove={noop}
        onArchive={noop}
        onExtract={noop}
        onChecksum={noop}
        onPaste={noop}
        onQuickShare={noop}
        onShare={noop}
        onToggleFavorite={noop}
        onDelete={noop}
        onClose={noop}
      />,
    );

    expect(screen.getByRole('menuitem', { name: 'Info' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Quick Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('dismisses when focus tabs out', async () => {
    const user = userEvent.setup();
    render(<ContextMenuHarness />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus());
    await user.tab();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
