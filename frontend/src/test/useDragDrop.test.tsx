import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragDrop } from '../hooks/useDragDrop';
import type { FileEntry } from '../api/client';
import type { TransferDialogState } from '../components/overlay/Dialogs';

const entry: FileEntry = {
  name: 'test.txt', path: '/src/test.txt', type: 'file',
  size: 100, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false,
};

const folder: FileEntry = {
  name: 'folder', path: '/src/folder', type: 'folder',
  size: 0, modifiedAt: '', permissions: '', owner: '', group: '', hidden: false,
};

function createDragEvent(overrides: Partial<DragEvent> = {}): DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      setData: vi.fn(),
      files: [] as unknown as FileList,
      types: [] as string[],
      items: [] as unknown as DataTransferItemList,
      dropEffect: '',
    },
    ...overrides,
  } as unknown as DragEvent;
}

function mockDataTransferFile(files: File[]): Partial<DragEvent> {
  return {
    dataTransfer: {
      effectAllowed: '',
      setData: vi.fn(),
      files: files as unknown as FileList,
      types: ['Files'],
      items: files.map((f) => ({
        kind: 'file',
        type: f.type,
        webkitGetAsEntry: () => null,
      })) as unknown as DataTransferItemList,
      dropEffect: '',
    },
  };
}

describe('useDragDrop', () => {
  it('handleFileDragStart sets draggingPaths with selection', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [entry], ['/src/test.txt'], setTransferDialog, handleUploadFiles)
    );

    const event = createDragEvent();
    act(() => {
      result.current.handleFileDragStart(event, entry);
    });

    expect(result.current.draggingPaths).toEqual(['/src/test.txt']);
    expect(event.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', '/src/test.txt');
  });

  it('handleFileDragStart uses entry path when no selection', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [entry], [], setTransferDialog, handleUploadFiles)
    );

    const event = createDragEvent();
    act(() => {
      result.current.handleFileDragStart(event, entry);
    });

    expect(result.current.draggingPaths).toEqual(['/src/test.txt']);
  });

  it('handleFolderDragOver sets dragOverPath', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [entry], [], setTransferDialog, handleUploadFiles)
    );

    act(() => {
      result.current.handleFileDragStart(createDragEvent(), entry);
    });

    const event = createDragEvent();
    act(() => {
      result.current.handleFolderDragOver(event, '/dst');
    });

    expect(result.current.dragOverPath).toBe('/dst');
  });

  it('handleFolderDragLeave clears dragOverPath', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [entry], [], setTransferDialog, handleUploadFiles)
    );

    act(() => result.current.handleFileDragStart(createDragEvent(), entry));
    act(() => result.current.handleFolderDragOver(createDragEvent(), '/dst'));

    expect(result.current.dragOverPath).toBe('/dst');

    act(() => result.current.handleFolderDragLeave());

    expect(result.current.dragOverPath).toBeNull();
  });

  it('handleDropOnFolder opens transfer dialog for dragged selection', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [entry], ['/src/test.txt'], setTransferDialog, handleUploadFiles)
    );

    const startEvent = createDragEvent();
    act(() => result.current.handleFileDragStart(startEvent, entry));

    const dropEvent = createDragEvent();

    act(() => {
      result.current.handleDropOnFolder(dropEvent, '/dst/folder');
    });

    expect(setTransferDialog).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'move', initialDestination: '/dst/folder' })
    );
    expect(result.current.draggingPaths).toBeNull();
  });

  it('handleFileAreaDragOver sets draggingUpload when canWrite', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [], [], setTransferDialog, handleUploadFiles)
    );

    const event = createDragEvent({ dataTransfer: { ...createDragEvent().dataTransfer, types: ['Files'] } });

    act(() => {
      result.current.handleFileAreaDragOver(event);
    });

    expect(result.current.draggingUpload).toBe(true);
  });

  it('handleFileAreaDragOver does not set draggingUpload when !canWrite', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(false, [], [], setTransferDialog, handleUploadFiles)
    );

    const event = createDragEvent({ dataTransfer: { ...createDragEvent().dataTransfer, types: ['Files'] } });

    act(() => {
      result.current.handleFileAreaDragOver(event);
    });

    expect(result.current.draggingUpload).toBe(false);
  });

  it('handleFileAreaDrop calls handleUploadFiles when canWrite', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [], [], setTransferDialog, handleUploadFiles)
    );

    const file = new File(['content'], 'file.txt');
    const event = createDragEvent(mockDataTransferFile([file]));

    act(() => {
      result.current.handleFileAreaDrop(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(handleUploadFiles).toHaveBeenCalled();
  });

  it('handleFileAreaDrop does not call handleUploadFiles when !canWrite', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(false, [], [], setTransferDialog, handleUploadFiles)
    );

    const file = new File(['content'], 'file.txt');
    const event = createDragEvent(mockDataTransferFile([file]));

    act(() => {
      result.current.handleFileAreaDrop(event);
    });

    expect(handleUploadFiles).not.toHaveBeenCalled();
  });

  it('onUnsupportedDrop is called when a directory is dropped', () => {
    const setTransferDialog = vi.fn();
    const handleUploadFiles = vi.fn();
    const onUnsupportedDrop = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop(true, [], [], setTransferDialog, handleUploadFiles, onUnsupportedDrop)
    );

    const dirEntry = { isDirectory: true };
    const event: Partial<DragEvent> = {
      preventDefault: vi.fn(),
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        files: [] as unknown as FileList,
        types: ['Files'],
        items: [{
          kind: 'file',
          type: '',
          webkitGetAsEntry: () => dirEntry,
        }] as unknown as DataTransferItemList,
        dropEffect: '',
      },
    };

    act(() => {
      result.current.handleFileAreaDrop(event as DragEvent);
    });

    expect(onUnsupportedDrop).toHaveBeenCalledWith('Folder and app-bundle uploads are not supported yet');
    expect(handleUploadFiles).not.toHaveBeenCalled();
  });
});
