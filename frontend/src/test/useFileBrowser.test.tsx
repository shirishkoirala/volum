import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFileBrowser } from '../hooks/useFileBrowser';
import type { Session, FileEntry } from '../api/client';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  getRoots: vi.fn(),
  getDevices: vi.fn(),
  getFiles: vi.fn(),
  getTrash: vi.fn(),
  searchFiles: vi.fn(),
}));

const fakeSession: Session = { authEnabled: true, authenticated: true, role: 'admin' };
const readonlySession: Session = { authEnabled: true, authenticated: true, role: 'readonly' };

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'file.txt',
    path: '/root/file.txt',
    type: 'file',
    size: 100,
    modifiedAt: '2026-06-10T10:00:00Z',
    permissions: 'rw-r--r--',
    owner: 'admin',
    group: 'users',
    hidden: false,
    ...overrides,
  };
}

function makeDir(overrides: Partial<FileEntry> = {}): FileEntry {
  return makeFile({ name: 'folder', path: '/root/folder', type: 'directory', ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.getRoots as ReturnType<typeof vi.fn>).mockResolvedValue({ roots: [{ path: '/root', label: 'Root', available: true, discovered: false, totalBytes: 0, freeBytes: 0, usedBytes: 0, isHome: false }] });
  (api.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue({ devices: [] });
  (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ entries: [], total: 0, limit: 600, offset: 0, hasMore: false });
  (api.getTrash as ReturnType<typeof vi.fn>).mockResolvedValue({ entries: [] });
  (api.searchFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
});

describe('useFileBrowser', () => {
  it('loads roots on mount', async () => {
    renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(api.getRoots).toHaveBeenCalledOnce();
    });
  });

  it('loads devices on mount', async () => {
    renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(api.getDevices).toHaveBeenCalledOnce();
    });
  });

  it('returns canWrite=true for admin', () => {
    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    expect(result.current.canWrite).toBe(true);
  });

  it('returns canWrite=false for readonly', () => {
    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: readonlySession }));
    expect(result.current.canWrite).toBe(false);
  });

  it('loads files for the current path', async () => {
    const files = [makeFile()];
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ entries: files, total: 1, limit: 600, offset: 0, hasMore: false });

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledWith('/root', false, { limit: 600, offset: 0 });
    });
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]?.name).toBe('file.txt');
    });
  });

  it('sets loading state during file fetch', async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => { resolvePromise = resolve; });
    (api.getFiles as ReturnType<typeof vi.fn>).mockReturnValue(promise);

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    expect(result.current.loading).toBe(true);

    act(() => { resolvePromise!({ entries: [], total: 0, limit: 600, offset: 0, hasMore: false }); });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('sets error on file fetch failure', async () => {
    (api.getFiles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('filters entries by query', async () => {
    const entries = [makeFile({ name: 'readme.md' }), makeDir({ name: 'images' }), makeFile({ name: 'data.csv' })];
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ entries, total: 3, limit: 600, offset: 0, hasMore: false });

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });

    act(() => { result.current.setQuery('readme'); });
    expect(result.current.filteredEntries).toHaveLength(1);
    expect(result.current.filteredEntries[0]?.name).toBe('readme.md');
  });

  it('returns directories first in filtered entries', async () => {
    const entries = [makeFile({ name: 'z_file.txt' }), makeDir({ name: 'a_folder' })];
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ entries, total: 2, limit: 600, offset: 0, hasMore: false });

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });
    expect(result.current.filteredEntries[0]?.type).toBe('directory');
    expect(result.current.filteredEntries[0]?.name).toBe('a_folder');
    expect(result.current.filteredEntries[1]?.type).toBe('file');
  });

  it('loads trash entries on mount', async () => {
    renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(api.getTrash).toHaveBeenCalledOnce();
    });
  });

  it('sets search results for queries with >=2 chars', async () => {
    const results = [{ name: 'found.txt', path: '/root/found.txt', type: 'file', size: 10, modifiedAt: '', root: '/root' }];
    (api.searchFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ results });

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    act(() => { result.current.handleGlobalSearch('fo'); });
    await waitFor(() => {
      expect(api.searchFiles).toHaveBeenCalledWith('fo', 20);
    });
    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(1);
    });
  });

  it('clears search results for short queries', () => {
    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    act(() => { result.current.handleGlobalSearch('f'); });
    expect(result.current.searchResults).toBeNull();
  });

  it('creates breadcrumbs from current path', async () => {
    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root/folder/sub', showHidden: false, session: fakeSession }));
    expect(result.current.breadcrumbs).toEqual([
      { label: 'root', path: '/root' },
      { label: 'folder', path: '/root/folder' },
      { label: 'sub', path: '/root/folder/sub' },
    ]);
  });

  it('returns root breadcrumb for root path', async () => {
    const { result } = renderHook(() => useFileBrowser({ currentPath: '/', showHidden: false, session: fakeSession }));
    expect(result.current.breadcrumbs).toEqual([{ label: '/', path: '/' }]);
  });

  it('returns empty breadcrumbs for empty path', () => {
    const { result } = renderHook(() => useFileBrowser({ currentPath: '', showHidden: false, session: fakeSession }));
    expect(result.current.breadcrumbs).toEqual([]);
  });

  it('refresh triggers file reload', async () => {
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ entries: [makeFile()], total: 1, limit: 600, offset: 0, hasMore: false });

    const { result } = renderHook(() => useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }));
    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledTimes(1);
    });

    act(() => { result.current.refresh(); });
    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledTimes(2);
    });
  });
});
