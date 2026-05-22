import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, TextInputDialog, ToastViewport, FolderSuggestions } from '../components/Dialogs';
import type { ConfirmDialogState, TextInputDialogState, Toast } from '../components/Dialogs';

describe('ConfirmDialog', () => {
  const baseDialog: NonNullable<ConfirmDialogState> = {
    title: 'Delete file?',
    message: 'Are you sure you want to delete this file?',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: vi.fn(),
  };

  it('renders title and message', () => {
    render(<ConfirmDialog dialog={baseDialog} onClose={vi.fn()} />);
    expect(screen.getByText('Delete file?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this file?')).toBeInTheDocument();
  });

  it('renders cancel and confirm buttons', () => {
    render(<ConfirmDialog dialog={baseDialog} onClose={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm is clicked', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog dialog={{ ...baseDialog, onConfirm }} onClose={onClose} />);
    await user.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog dialog={baseDialog} onClose={onClose} />);
    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('TextInputDialog', () => {
  const baseDialog: NonNullable<TextInputDialogState> = {
    title: 'New Folder',
    label: 'Folder name',
    placeholder: 'Folder name',
    confirmLabel: 'Create',
    onSubmit: vi.fn(),
  };

  it('renders title, label, and input', () => {
    render(<TextInputDialog dialog={baseDialog} onClose={vi.fn()} />);
    expect(screen.getByText('New Folder')).toBeInTheDocument();
    expect(screen.getByText('Folder name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Folder name')).toBeInTheDocument();
  });

  it('calls onSubmit with the input value', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TextInputDialog dialog={{ ...baseDialog, onSubmit }} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Folder name');
    await user.type(input, 'my-folder');
    await user.click(screen.getByText('Create'));
    expect(onSubmit).toHaveBeenCalledWith('my-folder');
  });

  it('shows error when submitting empty value', async () => {
    const user = userEvent.setup();
    render(<TextInputDialog dialog={baseDialog} onClose={vi.fn()} />);
    await user.click(screen.getByText('Create'));
    expect(screen.getByText('Folder name is required.')).toBeInTheDocument();
  });

  it('renders folder suggestions when provided', () => {
    const dialog: NonNullable<TextInputDialogState> = {
      ...baseDialog,
      folderSuggestions: ['/storage', '/storage/docs'],
      suggestionLabel: 'Create in',
    };
    render(<TextInputDialog dialog={dialog} onClose={vi.fn()} />);
    expect(screen.getByText('Create in')).toBeInTheDocument();
    expect(screen.getByText('docs')).toBeInTheDocument();
  });
});

describe('FolderSuggestions', () => {
  it('renders label and path buttons', () => {
    const onSelect = vi.fn();
    render(<FolderSuggestions label="Jump to" paths={['/storage', '/storage/docs']} onSelect={onSelect} />);
    expect(screen.getByText('Jump to')).toBeInTheDocument();
    expect(screen.getByTitle('/storage')).toBeInTheDocument();
    expect(screen.getByTitle('/storage/docs')).toBeInTheDocument();
  });

  it('calls onSelect when a path is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FolderSuggestions label="Jump to" paths={['/storage']} onSelect={onSelect} />);
    await user.click(screen.getByTitle('/storage'));
    expect(onSelect).toHaveBeenCalledWith('/storage');
  });

  it('displays / for root path', () => {
    render(<FolderSuggestions label="Folders" paths={['/']} onSelect={vi.fn()} />);
    expect(screen.getByText('/')).toBeInTheDocument();
  });
});

describe('ToastViewport', () => {
  it('renders nothing with no toasts', () => {
    const { container } = render(<ToastViewport toasts={[]} onDismiss={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toast title and message', () => {
    const toasts: Toast[] = [
      { id: 1, title: 'Success', message: 'File saved', variant: 'success' },
    ];
    render(<ToastViewport toasts={toasts} onDismiss={vi.fn()} />);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('File saved')).toBeInTheDocument();
  });

  it('renders error variant', () => {
    const toasts: Toast[] = [
      { id: 1, title: 'Failed', variant: 'error' },
    ];
    render(<ToastViewport toasts={toasts} onDismiss={vi.fn()} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    const toasts: Toast[] = [
      { id: 1, title: 'Success', variant: 'success' },
    ];
    render(<ToastViewport toasts={toasts} onDismiss={onDismiss} />);
    await user.click(screen.getByLabelText('Dismiss notification'));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
