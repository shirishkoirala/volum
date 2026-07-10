import type { AppMenuHandlers } from './AppMenuBar';

export type MenuItem = {
  label: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

export function buildFileItems(
  handlers: AppMenuHandlers,
  windowType?: string,
): MenuItem[] {
  if (windowType === 'trash') {
    return [
      {
        label: 'Restore',
        icon: 'edit-undo',
        disabled: handlers.selectedCount === 0,
        onClick: () => handlers.onRestore?.(),
      },
      {
        label: 'Delete Forever',
        icon: 'edit-delete',
        disabled: handlers.selectedCount === 0,
        danger: true,
        onClick: () => handlers.onDeleteForever?.(),
      },
      { label: '---', disabled: true, onClick: () => {} },
      {
        label: 'Empty Trash',
        icon: 'edit-clear',
        danger: true,
        onClick: () => handlers.onEmptyTrash?.(),
      },
      { label: '---', disabled: true, onClick: () => {} },
      {
        label: 'Close',
        icon: 'window-close',
        onClick: handlers.onClose ?? handlers.onGoDesktop,
      },
    ];
  }

  return [
    {
      label: 'New Folder',
      icon: 'folder-new',
      disabled: !handlers.canWrite,
      onClick: handlers.onCreateFolder,
    },
    {
      label: 'Upload',
      icon: 'document-import',
      disabled: !handlers.canUpload,
      onClick: handlers.onUpload,
    },
    { label: '---', disabled: true, onClick: () => {} },
    {
      label: 'Close',
      icon: 'window-close',
      onClick: handlers.onClose ?? handlers.onGoDesktop,
    },
  ];
}

export function buildEditItems(
  handlers: AppMenuHandlers,
  windowType?: string,
): MenuItem[] {
  if (windowType === 'trash') {
    return [
      { label: 'Select All', icon: 'selection-select-all', onClick: handlers.onSelectAll },
      { label: 'Invert Selection', icon: 'selection-invert', onClick: handlers.onInvertSelection },
    ];
  }

  return [
    { label: 'Cut', icon: 'edit-cut', disabled: !handlers.canWrite || handlers.selectedCount === 0, onClick: handlers.onCut },
    { label: 'Copy', icon: 'edit-copy', disabled: handlers.selectedCount === 0, onClick: handlers.onCopy },
    { label: 'Paste', icon: 'edit-paste', disabled: !handlers.canWrite, onClick: handlers.onPaste },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Select All', icon: 'selection-select-all', onClick: handlers.onSelectAll },
    { label: 'Invert Selection', icon: 'selection-invert', onClick: handlers.onInvertSelection },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Rename', icon: 'edit-rename', disabled: !handlers.canWrite || handlers.selectedCount === 0, onClick: handlers.onRename },
    { label: 'Delete', icon: 'edit-delete', disabled: !handlers.canWrite || handlers.selectedCount === 0, danger: true, onClick: handlers.onDelete },
  ];
}

export function buildViewItems(handlers: AppMenuHandlers): MenuItem[] {
  return [
    { label: `Grid${handlers.viewMode === 'grid' ? ' ✓' : ''}`, icon: 'view-grid', onClick: () => handlers.onSetViewMode('grid') },
    { label: `List${handlers.viewMode === 'list' ? ' ✓' : ''}`, icon: 'view-list-tree', onClick: () => handlers.onSetViewMode('list') },
    { label: '---', disabled: true, onClick: () => {} },
    { label: `${handlers.showHidden ? 'Hide' : 'Show'} Hidden Files`, icon: 'view-hidden', onClick: handlers.onToggleHidden },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Sort by Name', icon: 'sort-desc', onClick: () => handlers.onSortChange('name:asc') },
    { label: 'Sort by Size', icon: 'sort-desc', onClick: () => handlers.onSortChange('size:desc') },
    { label: 'Sort by Type', icon: 'sort-desc', onClick: () => handlers.onSortChange('type:asc') },
    { label: 'Sort by Date', icon: 'sort-desc', onClick: () => handlers.onSortChange('modifiedAt:desc') },
  ];
}

export function buildGoItems(handlers: AppMenuHandlers, windowType?: string): MenuItem[] {
  const items: MenuItem[] = [
    { label: 'Desktop', icon: 'go-home', onClick: handlers.onGoDesktop },
    { label: 'Files', icon: 'folder', onClick: handlers.onGoFiles },
    { label: 'Trash', icon: 'edit-delete', onClick: handlers.onGoTrash },
    { label: 'Transfers', icon: 'document-properties', onClick: handlers.onGoJobs },
    { label: 'Settings', icon: 'preferences-system', onClick: handlers.onGoSettings },
  ];

  if (windowType !== 'trash') {
    items.push(
      { label: '---', disabled: true, onClick: () => {} },
      { label: 'Go to Location...', icon: 'go-jump', onClick: handlers.onToggleLocation },
    );
  }

  return items;
}
