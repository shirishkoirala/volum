import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from '../hooks/useSelection';
import type { FileEntry, TrashEntry } from '../api/client';

function makeFile(name: string, type: 'file' | 'directory' = 'file'): FileEntry {
  return { name, path: `/root/${name}`, type, size: 100, modifiedAt: '', permissions: 'rw-r--r--', owner: 'admin', group: 'users', hidden: false };
}

function makeTrash(id: string): TrashEntry {
  return { id, name: `file-${id}.txt`, originalPath: `/root/file-${id}.txt`, trashPath: `/trash/${id}`, type: 'file', size: 100, deletedAt: '2026-06-10T10:00:00Z', rootPath: '/root' };
}

const emptyEntries: FileEntry[] = [];
const emptyTrash: TrashEntry[] = [];

describe('useSelection', () => {
  it('initial state has empty selections and all can* false', () => {
    const { result } = renderHook(() => useSelection({ filteredEntries: emptyEntries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));
    expect(result.current.selectedPaths).toEqual([]);
    expect(result.current.selectedTrashIds).toEqual([]);
    expect(result.current.canRename).toBe(false);
    expect(result.current.canDownload).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.canCopy).toBe(false);
    expect(result.current.canMove).toBe(false);
    expect(result.current.canInfo).toBe(false);
    expect(result.current.canPreview).toBe(false);
    expect(result.current.canArchive).toBe(false);
    expect(result.current.canExtract).toBe(false);
    expect(result.current.canAnalyze).toBe(false);
    expect(result.current.canChecksum).toBe(false);
  });

  it('readonly cannot checksum', () => {
    const { result } = renderHook(() => useSelection({ filteredEntries: emptyEntries, trashEntries: emptyTrash, favorites: [], canWrite: false, currentPath: '/root' }));
    expect(result.current.canChecksum).toBe(false);
    expect(result.current.canPaste).toBe(false);
  });

  it('selecting one file sets canRename, canDownload, canPreview, canArchive to true', () => {
    const entries = [makeFile('doc.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleContextMenuEvent(entries[0]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, false); });

    expect(result.current.selectedPaths).toEqual(['/root/doc.txt']);
    expect(result.current.canRename).toBe(true);
    expect(result.current.canDownload).toBe(true);
    expect(result.current.canPreview).toBe(true);
    expect(result.current.canArchive).toBe(true);
    expect(result.current.canChecksum).toBe(true);
  });

  it('selecting multiple files disables canRename, canDownload, canPreview, canInfo', () => {
    const entries = [makeFile('a.txt'), makeFile('b.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleContextMenuEvent(entries[0]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, false); });
    act(() => { result.current.handleContextMenuEvent(entries[1]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, false); });

    expect(result.current.selectedPaths).toHaveLength(1);
    expect(result.current.canRename).toBe(true);
  });

  it('selectAll selects all filtered entries', () => {
    const entries = [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleSelectAll(); });

    expect(result.current.selectedPaths).toHaveLength(3);
    expect(result.current.canDelete).toBe(true);
    expect(result.current.canCopy).toBe(true);
    expect(result.current.canMove).toBe(true);
    expect(result.current.canRename).toBe(false);
  });

  it('invertSelection inverts the selected set', () => {
    const entries = [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleSelectAll(); });
    act(() => { result.current.handleInvertSelection(); });

    expect(result.current.selectedPaths).toEqual([]);
  });

  it('clicking background clears selection', () => {
    const entries = [makeFile('a.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleContextMenuEvent(entries[0]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, false); });
    expect(result.current.selectedPaths).toHaveLength(1);

    const el = document.createElement('div');
    act(() => { result.current.handleFileClick({ target: el, currentTarget: el } as unknown as React.MouseEvent<HTMLElement>); });
    expect(result.current.selectedPaths).toEqual([]);
  });

  it('selecting a directory sets canAnalyze true', () => {
    const entries = [makeFile('images', 'directory')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleContextMenuEvent(entries[0]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, false); });

    expect(result.current.canAnalyze).toBe(true);
    expect(result.current.canPreview).toBe(false);
  });

  it('shift-click on trash selects a range', () => {
    const trash = [makeTrash('1'), makeTrash('2'), makeTrash('3')];
    const { result } = renderHook(() => useSelection({ filteredEntries: emptyEntries, trashEntries: trash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleSelectTrashItem(trash[0]!, { shiftKey: false, metaKey: false, ctrlKey: false } as React.MouseEvent<HTMLElement>); });
    act(() => { result.current.handleSelectTrashItem(trash[2]!, { shiftKey: true, metaKey: false, ctrlKey: false } as React.MouseEvent<HTMLElement>); });

    expect(result.current.selectedTrashIds).toEqual(['1', '2', '3']);
  });

  it('cmd-click on trash toggles selection', () => {
    const trash = [makeTrash('1'), makeTrash('2')];
    const { result } = renderHook(() => useSelection({ filteredEntries: emptyEntries, trashEntries: trash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleSelectTrashItem(trash[0]!, { shiftKey: false, metaKey: true, ctrlKey: false } as React.MouseEvent<HTMLElement>); });
    act(() => { result.current.handleSelectTrashItem(trash[1]!, { shiftKey: false, metaKey: true, ctrlKey: false } as React.MouseEvent<HTMLElement>); });
    expect(result.current.selectedTrashIds).toHaveLength(2);

    act(() => { result.current.handleSelectTrashItem(trash[0]!, { shiftKey: false, metaKey: true, ctrlKey: false } as React.MouseEvent<HTMLElement>); });
    expect(result.current.selectedTrashIds).toHaveLength(1);
  });

  it('isFavorited reflects current path in favorites', () => {
    const { result, rerender } = renderHook(
      ({ favorites, currentPath }) => useSelection({ filteredEntries: emptyEntries, trashEntries: emptyTrash, favorites, canWrite: true, currentPath }),
      { initialProps: { favorites: ['/root'], currentPath: '/root' } }
    );

    expect(result.current.isFavorited).toBe(true);

    rerender({ favorites: ['/other'], currentPath: '/root' });

    expect(result.current.isFavorited).toBe(false);
  });

  it('context menu selects a new entry when not already selected', () => {
    const entries = [makeFile('a.txt'), makeFile('b.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => {
      const outcome = result.current.handleContextMenuEvent(entries[1]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, false);
      expect(outcome.shouldSelect).toBe(true);
    });

    expect(result.current.selectedPaths).toEqual(['/root/b.txt']);
  });

  it('context menu blocks when renaming in progress', () => {
    const entries = [makeFile('a.txt')];
    const { result } = renderHook(() => useSelection({ filteredEntries: entries, trashEntries: emptyTrash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => {
      const outcome = result.current.handleContextMenuEvent(entries[0]!, { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLElement>, true);
      expect(outcome.blocked).toBe(true);
      expect(outcome.shouldSelect).toBe(false);
    });

    expect(result.current.selectedPaths).toEqual([]);
  });

  it('trash click on already-selected single item deselects it', () => {
    const trash = [makeTrash('1')];
    const { result } = renderHook(() => useSelection({ filteredEntries: emptyEntries, trashEntries: trash, favorites: [], canWrite: true, currentPath: '/root' }));

    act(() => { result.current.handleSelectTrashItem(trash[0]!, { shiftKey: false, metaKey: false, ctrlKey: false } as React.MouseEvent<HTMLElement>); });
    expect(result.current.selectedTrashIds).toEqual(['1']);

    act(() => { result.current.handleSelectTrashItem(trash[0]!, { shiftKey: false, metaKey: false, ctrlKey: false } as React.MouseEvent<HTMLElement>); });
    expect(result.current.selectedTrashIds).toEqual([]);
  });
});
