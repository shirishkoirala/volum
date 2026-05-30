import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppMenuBar, type AppMenuHandlers } from '../components/layout/AppMenuBar';

const noop = () => {};

const baseHandlers: AppMenuHandlers = {
  onCreateFolder: noop,
  onUpload: noop,
  onCut: noop,
  onCopy: noop,
  onPaste: noop,
  onSelectAll: noop,
  onInvertSelection: noop,
  onRename: noop,
  onDelete: noop,
  viewMode: 'grid',
  onSetViewMode: noop,
  showHidden: false,
  onToggleHidden: noop,
  sortField: 'name',
  sortDirection: 'asc',
  onSortChange: noop,
  onGoDesktop: noop,
  onGoFiles: noop,
  onGoTrash: noop,
  onGoJobs: noop,
  onGoSettings: noop,
  onToggleLocation: noop,
  canWrite: true,
  selectedCount: 0,
};

describe('AppMenuBar', () => {
  it('renders File, Edit, View, Go menus', () => {
    render(<AppMenuBar handlers={baseHandlers} />);
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('opens File menu on click', async () => {
    const user = userEvent.setup();
    render(<AppMenuBar handlers={baseHandlers} />);
    await user.click(screen.getByText('File'));
    expect(screen.getByText('New Folder')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('opens Edit menu on click', async () => {
    const user = userEvent.setup();
    render(<AppMenuBar handlers={baseHandlers} />);
    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Cut')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Paste')).toBeInTheDocument();
  });

  it('opens View menu on click', async () => {
    const user = userEvent.setup();
    render(<AppMenuBar handlers={baseHandlers} />);
    await user.click(screen.getByText('View'));
    expect(screen.getByText(/Grid/)).toBeInTheDocument();
    expect(screen.getByText(/List/)).toBeInTheDocument();
  });

  it('opens Go menu on click', async () => {
    const user = userEvent.setup();
    render(<AppMenuBar handlers={baseHandlers} />);
    await user.click(screen.getByText('Go'));
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Go to Location...')).toBeInTheDocument();
  });

  it('calls onCreateFolder from File menu', async () => {
    const user = userEvent.setup();
    const onCreateFolder = vi.fn();
    render(<AppMenuBar handlers={{ ...baseHandlers, onCreateFolder }} />);
    await user.click(screen.getByText('File'));
    await user.click(screen.getByText('New Folder'));
    expect(onCreateFolder).toHaveBeenCalledOnce();
  });

  it('calls onSelectAll from Edit menu', async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    render(<AppMenuBar handlers={{ ...baseHandlers, onSelectAll }} />);
    await user.click(screen.getByText('Edit'));
    await user.click(screen.getByText('Select All'));
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it('disables items when canWrite is false', async () => {
    const user = userEvent.setup();
    render(<AppMenuBar handlers={{ ...baseHandlers, canWrite: false }} />);
    await user.click(screen.getByText('File'));
    const newFolderBtn = screen.getByText('New Folder');
    expect(newFolderBtn.closest('button')).toBeDisabled();
  });

  it('calls onSetViewMode from View menu', async () => {
    const user = userEvent.setup();
    const onSetViewMode = vi.fn();
    render(<AppMenuBar handlers={{ ...baseHandlers, onSetViewMode }} />);
    await user.click(screen.getByText('View'));
    await user.click(screen.getByText(/Grid/));
    expect(onSetViewMode).toHaveBeenCalledWith('grid');
  });

  it('shows checkmark on current view mode', async () => {
    const user = userEvent.setup();
    render(<AppMenuBar handlers={{ ...baseHandlers, viewMode: 'list' }} />);
    await user.click(screen.getByText('View'));
    const listItem = screen.getByText(/List/);
    expect(listItem.textContent).toContain('✓');
  });

  it('closes menu after clicking an item', async () => {
    const user = userEvent.setup();
    const onCreateFolder = vi.fn();
    render(<AppMenuBar handlers={{ ...baseHandlers, onCreateFolder }} />);
    await user.click(screen.getByText('File'));
    await user.click(screen.getByText('New Folder'));
    expect(onCreateFolder).toHaveBeenCalledOnce();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
  });
});
