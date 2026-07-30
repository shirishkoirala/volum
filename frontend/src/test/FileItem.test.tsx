import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileItem } from '../components/ui/FileItem';
import { buildFileEntry } from './fixtures';

describe('FileItem', () => {
  it('exposes selection and supports keyboard activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();

    render(
      <FileItem
        entry={buildFileEntry({ name: 'report.txt', path: '/report.txt' })}
        viewMode="list"
        isSelected
        isDragOver={false}
        canWrite
        isFavorited={false}
        renameState={null}
        onContextMenu={vi.fn()}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onDragStart={vi.fn()}
        onCommitRename={vi.fn()}
        onCancelRename={vi.fn()}
        onRenameChange={vi.fn()}
        index={2}
        tabIndex={0}
      />,
    );

    const item = screen.getByRole('option');
    expect(item).toHaveAttribute('aria-selected', 'true');
    expect(item).toHaveAttribute('data-index', '2');
    expect(item).toHaveAttribute('tabindex', '0');

    item.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
    await user.keyboard(' ');
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses native textbox semantics while renaming', () => {
    render(
      <FileItem
        entry={buildFileEntry({ name: 'report.txt', path: '/report.txt' })}
        viewMode="list"
        isSelected
        isDragOver={false}
        canWrite
        isFavorited={false}
        renameState={{ path: '/report.txt', value: 'report.txt' }}
        onContextMenu={vi.fn()}
        onClick={vi.fn()}
        onFocus={vi.fn()}
        onKeyDown={vi.fn()}
        onDragStart={vi.fn()}
        onCommitRename={vi.fn()}
        onCancelRename={vi.fn()}
        onRenameChange={vi.fn()}
        index={2}
        tabIndex={0}
      />,
    );

    const textbox = screen.getByRole('textbox', { name: 'Rename report.txt' });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(textbox.parentElement).toHaveAttribute('tabindex', '-1');
  });
});
