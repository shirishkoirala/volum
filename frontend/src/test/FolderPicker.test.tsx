import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderPicker } from '../components/input/FolderPicker';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = mockFetch;
});

const mockSubdirs = [
  {
    name: 'Documents',
    path: '/storage/Documents',
    type: 'directory',
    size: 0,
    modifiedAt: '',
    permissions: '',
    owner: '',
    group: '',
    hidden: false,
  },
  {
    name: 'Photos',
    path: '/storage/Photos',
    type: 'directory',
    size: 0,
    modifiedAt: '',
    permissions: '',
    owner: '',
    group: '',
    hidden: false,
  },
  {
    name: 'file.txt',
    path: '/storage/file.txt',
    type: 'file',
    size: 100,
    modifiedAt: '',
    permissions: '',
    owner: '',
    group: '',
    hidden: false,
  },
];

describe('FolderPicker', () => {
  it('renders initial path and loads subdirectories', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entries: mockSubdirs }),
    });

    render(<FolderPicker initialPath="/storage" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('Select destination')).toBeInTheDocument();
    expect(screen.getByText('/storage')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Photos')).toBeInTheDocument();
    });

    expect(screen.queryByText('file.txt')).not.toBeInTheDocument();
  });

  it('calls onSelect when Choose is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });

    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FolderPicker initialPath="/storage" onSelect={onSelect} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No subdirectories')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Choose'));
    expect(onSelect).toHaveBeenCalledWith('/storage');
  });

  it('navigates before choosing a folder', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: mockSubdirs }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [] }),
      });

    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FolderPicker initialPath="/storage" onSelect={onSelect} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Documents'));
    await waitFor(() => expect(screen.getByText('/storage/Documents')).toBeInTheDocument());
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByText('Choose'));
    expect(onSelect).toHaveBeenCalledWith('/storage/Documents');
  });

  it('calls onClose when Cancel is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FolderPicker initialPath="/storage" onSelect={vi.fn()} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('No subdirectories')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    render(<FolderPicker initialPath="/storage" onSelect={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load folder/)).toBeInTheDocument();
    });
  });

  it('renders breadcrumb for nested path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });

    render(
      <FolderPicker initialPath="/storage/Documents/Work" onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });
});
