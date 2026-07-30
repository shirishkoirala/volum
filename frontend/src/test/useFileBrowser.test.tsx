import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFileBrowser } from '../hooks/useFileBrowser';
import type { Session } from '../api/client-auth';
import type { FileEntry } from '../api/client-files';
import * as api from '../api/client-files';
import { buildDirectoryEntry, buildFileEntry, buildRootEntry, buildSession } from './fixtures';

vi.mock('../api/client-files', () => ({
  getRoots: vi.fn(),
  getDevices: vi.fn(),
  getFiles: vi.fn(),
  getTrash: vi.fn(),
  searchFiles: vi.fn(),
}));

const fakeSession: Session = buildSession();
const readonlySession: Session = buildSession({ role: 'readonly' });

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return buildFileEntry({
    path: '/root/file.txt',
    size: 100,
    permissions: 'rw-r--r--',
    owner: 'admin',
    group: 'users',
    ...overrides,
  });
}

function makeDir(overrides: Partial<FileEntry> = {}): FileEntry {
  return buildDirectoryEntry({
    path: '/root/folder',
    owner: 'admin',
    group: 'users',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.getRoots as ReturnType<typeof vi.fn>).mockResolvedValue({
    roots: [buildRootEntry({ path: '/root', label: 'Root' })],
  });
  (api.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue({ devices: [] });
  (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
    entries: [],
    total: 0,
    limit: 600,
    offset: 0,
    hasMore: false,
  });
  (api.getTrash as ReturnType<typeof vi.fn>).mockResolvedValue({ entries: [] });
  (api.searchFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
});

describe('useFileBrowser', () => {
  it('loads roots on mount', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(api.getRoots).toHaveBeenCalledOnce();
      expect(result.current.roots).toHaveLength(1);
    });
  });

  it('loads devices on mount', async () => {
    (api.getDevices as ReturnType<typeof vi.fn>).mockResolvedValue({
      devices: [{ name: 'sda', size: '1 TB', type: 'disk', rotational: false }],
    });
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(api.getDevices).toHaveBeenCalledOnce();
      expect(result.current.devices).toHaveLength(1);
    });
  });

  it('returns canWrite=true for admin', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    expect(result.current.canWrite).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('returns canWrite=false for readonly', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: readonlySession }),
    );
    expect(result.current.canWrite).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('loads files for the current path', async () => {
    const files = [makeFile()];
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: files,
      total: 1,
      limit: 600,
      offset: 0,
      hasMore: false,
    });

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledWith('/root', false, { limit: 600, offset: 0 });
    });
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]?.name).toBe('file.txt');
    });
  });

  it('ignores an older folder response after navigation', async () => {
    const oldResponse = {
      entries: [makeFile({ name: 'old.txt', path: '/old/old.txt' })],
      total: 1,
      limit: 600,
      offset: 0,
      hasMore: false,
    };
    const newResponse = {
      entries: [makeFile({ name: 'new.txt', path: '/new/new.txt' })],
      total: 1,
      limit: 600,
      offset: 0,
      hasMore: false,
    };
    let resolveOld: ((value: typeof oldResponse) => void) | undefined;
    const oldRequest = new Promise<typeof oldResponse>((resolve) => {
      resolveOld = resolve;
    });
    (api.getFiles as ReturnType<typeof vi.fn>).mockImplementation((path: string) =>
      path === '/old' ? oldRequest : Promise.resolve(newResponse),
    );

    const { result, rerender } = renderHook(
      ({ path }) => useFileBrowser({ currentPath: path, showHidden: false, session: fakeSession }),
      { initialProps: { path: '/old' } },
    );
    await waitFor(() =>
      expect(api.getFiles).toHaveBeenCalledWith('/old', false, expect.anything()),
    );

    rerender({ path: '/new' });
    await waitFor(() => expect(result.current.entries[0]?.name).toBe('new.txt'));

    await act(async () => resolveOld?.(oldResponse));
    expect(result.current.entries[0]?.name).toBe('new.txt');
    expect(result.current.loading).toBe(false);
  });

  it('ignores an older load-more response after navigation', async () => {
    const oldFirstPage = {
      entries: [makeFile({ name: 'old-first.txt', path: '/old/old-first.txt' })],
      total: 2,
      limit: 600,
      offset: 0,
      hasMore: true,
    };
    const oldNextPage = {
      entries: [makeFile({ name: 'old-late.txt', path: '/old/old-late.txt' })],
      total: 2,
      limit: 600,
      offset: 1,
      hasMore: false,
    };
    const newResponse = {
      entries: [makeFile({ name: 'new.txt', path: '/new/new.txt' })],
      total: 1,
      limit: 600,
      offset: 0,
      hasMore: false,
    };
    let resolveOldNext: ((value: typeof oldNextPage) => void) | undefined;
    const oldNextRequest = new Promise<typeof oldNextPage>((resolve) => {
      resolveOldNext = resolve;
    });
    (api.getFiles as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string, _showHidden: boolean, options: { offset: number }) => {
        if (path === '/new') return Promise.resolve(newResponse);
        return options.offset === 0 ? Promise.resolve(oldFirstPage) : oldNextRequest;
      },
    );

    const { result, rerender } = renderHook(
      ({ path }) => useFileBrowser({ currentPath: path, showHidden: false, session: fakeSession }),
      { initialProps: { path: '/old' } },
    );
    await waitFor(() => expect(result.current.entries[0]?.name).toBe('old-first.txt'));

    act(() => result.current.loadMoreEntries());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));
    rerender({ path: '/new' });
    await waitFor(() => expect(result.current.entries[0]?.name).toBe('new.txt'));

    await act(async () => resolveOldNext?.(oldNextPage));
    expect(result.current.entries.map((entry) => entry.name)).toEqual(['new.txt']);
    expect(result.current.loadingMore).toBe(false);
  });

  it('sets loading state during file fetch', async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    (api.getFiles as ReturnType<typeof vi.fn>).mockReturnValue(promise);

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    expect(result.current.loading).toBe(true);

    act(() => {
      resolvePromise!({ entries: [], total: 0, limit: 600, offset: 0, hasMore: false });
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('sets error on file fetch failure', async () => {
    (api.getFiles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('filters entries by query', async () => {
    const entries = [
      makeFile({ name: 'readme.md' }),
      makeDir({ name: 'images' }),
      makeFile({ name: 'data.csv' }),
    ];
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries,
      total: 3,
      limit: 600,
      offset: 0,
      hasMore: false,
    });

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });

    act(() => {
      result.current.setQuery('readme');
    });
    expect(result.current.filteredEntries).toHaveLength(1);
    expect(result.current.filteredEntries[0]?.name).toBe('readme.md');
  });

  it('preserves server ordering in filtered entries', async () => {
    const entries = [makeFile({ name: 'z_file.txt' }), makeDir({ name: 'a_folder' })];
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries,
      total: 2,
      limit: 600,
      offset: 0,
      hasMore: false,
    });

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });
    expect(result.current.filteredEntries).toHaveLength(2);
    expect(result.current.filteredEntries[0]?.name).toBe('z_file.txt');
    expect(result.current.filteredEntries[1]?.name).toBe('a_folder');
  });

  it('loads trash entries on mount', async () => {
    (api.getTrash as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: [
        {
          id: 'trash-1',
          name: 'deleted.txt',
          originalPath: '/root/deleted.txt',
          trashPath: '/root/.trash/deleted.txt',
          type: 'file',
          size: 10,
          deletedAt: '2026-06-10T10:00:00Z',
          rootPath: '/root',
        },
      ],
    });
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(api.getTrash).toHaveBeenCalledOnce();
      expect(result.current.trashEntries).toHaveLength(1);
    });
  });

  it('sets search results for queries with >=2 chars', async () => {
    const results = [
      {
        name: 'found.txt',
        path: '/root/found.txt',
        type: 'file',
        size: 10,
        modifiedAt: '',
        root: '/root',
      },
    ];
    (api.searchFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ results });

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    act(() => {
      result.current.handleGlobalSearch('fo');
    });
    await waitFor(() => {
      expect(api.searchFiles).toHaveBeenCalledWith('fo', 20);
    });
    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(1);
    });
  });

  it('clears search results for short queries', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    act(() => {
      result.current.handleGlobalSearch('f');
    });
    expect(result.current.searchResults).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('distinguishes a search failure from no matches', async () => {
    (api.searchFiles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Search offline'));
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );

    act(() => result.current.handleGlobalSearch('lost'));

    await waitFor(() => {
      expect(result.current.searchLoading).toBe(false);
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchError).toBe('Search offline');
    });

    act(() => result.current.resetGlobalSearch());
    expect(result.current.searchError).toBeNull();
    expect(result.current.searchResults).toBeNull();
  });

  it('creates breadcrumbs from current path', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root/folder/sub', showHidden: false, session: fakeSession }),
    );
    expect(result.current.breadcrumbs).toEqual([
      { label: 'root', path: '/root' },
      { label: 'folder', path: '/root/folder' },
      { label: 'sub', path: '/root/folder/sub' },
    ]);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('returns root breadcrumb for root path', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/', showHidden: false, session: fakeSession }),
    );
    expect(result.current.breadcrumbs).toEqual([{ label: '/', path: '/' }]);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('returns empty breadcrumbs for empty path', async () => {
    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '', showHidden: false, session: fakeSession }),
    );
    expect(result.current.breadcrumbs).toEqual([]);
    await waitFor(() => expect(result.current.roots).toHaveLength(1));
  });

  it('refresh triggers file reload', async () => {
    (api.getFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: [makeFile()],
      total: 1,
      limit: 600,
      offset: 0,
      hasMore: false,
    });

    const { result } = renderHook(() =>
      useFileBrowser({ currentPath: '/root', showHidden: false, session: fakeSession }),
    );
    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledTimes(2);
    });
  });
});
