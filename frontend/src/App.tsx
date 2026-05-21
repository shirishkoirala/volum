import { DragEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, FileIcon, FolderIcon, DeviceIcon } from './components/Icon';
import {
  ConflictPolicy,
  FileEntry,
  Job,
  cancelJob,
  createCopyJob,
  createFolder,
  createMoveJob,
  deletePath,
  downloadUrl,
  getFiles,
  getJobs,
  getRoots,
  getSession,
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isVideoExtension,
  login,
  logout,
  pauseJob,
  renamePath,
  RootEntry,
  Session,
  resumeJob,
  retryJob,
  uploadFiles
} from './api/client';
import appIcon from './assets/icon-light.png';
import { PreviewModal } from './components/PreviewModal';

type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';
type ContextMenuState = {
  x: number;
  y: number;
  entry: FileEntry;
} | null;

export function App() {
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canWrite = session?.role === 'admin';

  useEffect(() => {
    getSession()
      .then((value) => setSession(value))
      .catch((err: Error) => setError(err.message))
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    getRoots()
      .then((response) => {
        const safeRoots = response.roots ?? [];
        setRoots(safeRoots);
        setCurrentPath(safeRoots[0]?.path ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, [session, sessionLoading]);

  useEffect(() => {
    if (!currentPath) {
      return;
    }
    setLoading(true);
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setContextMenu(null);
    getFiles(currentPath, showHidden)
      .then((response) => {
        setEntries(response.entries ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentPath, refreshKey, showHidden]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setError(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleCreateFolder = () => {
    const name = window.prompt('Folder name');
    if (name === null) {
      return;
    }
    void runAction(() => createFolder(currentPath, name.trim()));
  };

  const handleRename = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry) {
      return;
    }
    const newName = window.prompt('New name', entry.name);
    if (newName === null || newName.trim() === entry.name) {
      return;
    }
    void runAction(() => renamePath(entry.path, newName.trim()));
  };

  const handleDelete = () => {
    if (selectedEntries.length === 0) {
      return;
    }
    const label =
      selectedEntries.length === 1
        ? `"${selectedEntries[0].name}"`
        : `${selectedEntries.length} selected items`;
    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    void runAction(async () => {
      for (const entry of selectedEntries) {
        await deletePath(entry.path, entry.name);
      }
    });
  };

  const handleDownload = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry || entry.type !== 'file') {
      return;
    }
    window.location.href = downloadUrl(entry.path);
  };

  const handlePreview = () => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry || entry.type !== 'file') {
      return;
    }
    const ext = entry.name.toLowerCase();
    if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext)) {
      setPreviewEntry(entry);
    } else {
      window.open(downloadUrl(entry.path), '_blank');
    }
  };

  const handleUploadFiles = (files: FileList | File[]) => {
    if (!canWrite) {
      return;
    }
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0 || !currentPath) {
      return;
    }
    void runAction(async () => {
      await uploadFiles(currentPath, selectedFiles);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    });
  };

  const handleLoggedIn = (nextSession: Session) => {
    setSession(nextSession);
    refresh();
  };

  const handleLogout = () => {
    void logout().then((nextSession) => {
      setSession(nextSession);
      setRoots([]);
      setCurrentPath('');
      setEntries([]);
      setJobs([]);
    });
  };

  useEffect(() => {
    if (sessionLoading || (session?.authEnabled && !session.authenticated)) {
      return;
    }
    getJobs()
      .then((response) => setJobs(response.jobs ?? []))
      .catch(() => undefined);

    const events = new EventSource('/api/jobs/events');
    events.addEventListener('jobs', (event) => {
      const response = JSON.parse((event as MessageEvent).data) as { jobs: Job[] | null };
      setJobs(response.jobs ?? []);
    });
    events.onerror = () => undefined;
    return () => events.close();
  }, [session, sessionLoading]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? entries.filter((entry) => entry.name.toLowerCase().includes(needle))
      : entries;

    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'size') {
        return (a.size - b.size) * direction;
      }
      if (sortField === 'modifiedAt') {
        return (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()) * direction;
      }
      const aValue = sortField === 'type' ? a.type : a.name;
      const bValue = sortField === 'type' ? b.type : b.name;
      return aValue.localeCompare(bValue) * direction;
    });
  }, [entries, query, sortDirection, sortField]);

  const selectedEntries = useMemo(
    () => filteredEntries.filter((entry) => selectedPaths.includes(entry.path)),
    [filteredEntries, selectedPaths]
  );

  const canRename = selectedEntries.length === 1;
  const canDownload = selectedEntries.length === 1 && selectedEntries[0].type === 'file';
  const canDelete = selectedEntries.length > 0;
  const canCopy = selectedEntries.length > 0;
  const canMove = selectedEntries.length > 0;
  const canPreview = selectedEntries.length === 1 && selectedEntries[0].type === 'file';
  const canSelect = filteredEntries.length > 0;

  const handleSelectAll = () => {
    const nextPaths = filteredEntries.map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
  };

  const handleInvertSelection = () => {
    const nextPaths = filteredEntries
      .filter((entry) => !selectedPaths.includes(entry.path))
      .map((entry) => entry.path);
    setSelectedPaths(nextPaths);
    setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
  };

  const handleCopy = () => {
    if (!canCopy) {
      return;
    }
    const destinationFolder = window.prompt('Destination folder path', currentPath);
    if (destinationFolder === null || destinationFolder.trim() === '') {
      return;
    }
    const conflictPolicy = promptConflictPolicy('ask');
    if (!conflictPolicy) {
      return;
    }
    const targetFolder = destinationFolder.trim().replace(/\/+$/, '');
    void runAction(async () => {
      for (const entry of selectedEntries) {
        await createCopyJob(entry.path, `${targetFolder}/${entry.name}`, conflictPolicy);
      }
    });
  };

  const handleMove = () => {
    if (!canMove) {
      return;
    }
    const destinationFolder = window.prompt('Destination folder path', currentPath);
    if (destinationFolder === null || destinationFolder.trim() === '') {
      return;
    }
    const conflictPolicy = promptConflictPolicy('ask');
    if (!conflictPolicy) {
      return;
    }
    const targetFolder = destinationFolder.trim().replace(/\/+$/, '');
    void runAction(async () => {
      for (const entry of selectedEntries) {
        await createMoveJob(entry.path, `${targetFolder}/${entry.name}`, conflictPolicy);
      }
    });
  };

  const handleCancelJob = (id: string) => {
    void runAction(async () => {
      await cancelJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    });
  };

  const handleRetryJob = (id: string) => {
    void runAction(async () => {
      await retryJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    });
  };

  const handlePauseJob = (id: string) => {
    void runAction(async () => {
      await pauseJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    });
  };

  const handleResumeJob = (id: string) => {
    void runAction(async () => {
      await resumeJob(id);
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    });
  };

  const handleSelectEntry = (entry: FileEntry, event: MouseEvent<HTMLButtonElement>) => {
    setContextMenu(null);

    if (event.shiftKey && lastSelectedPath) {
      const from = filteredEntries.findIndex((item) => item.path === lastSelectedPath);
      const to = filteredEntries.findIndex((item) => item.path === entry.path);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelectedPaths(filteredEntries.slice(start, end + 1).map((item) => item.path));
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      if (selectedPaths.includes(entry.path)) {
        const nextPaths = selectedPaths.filter((path) => path !== entry.path);
        setSelectedPaths(nextPaths);
        setLastSelectedPath(nextPaths.length > 0 ? nextPaths[nextPaths.length - 1] : null);
      } else {
        setSelectedPaths([...selectedPaths, entry.path]);
        setLastSelectedPath(entry.path);
      }
      return;
    }

    if (selectedPaths.includes(entry.path)) {
      setSelectedPaths((paths) => paths.filter((path) => path !== entry.path));
      setLastSelectedPath(null);
      return;
    }

    setSelectedPaths([entry.path]);
    setLastSelectedPath(entry.path);
  };

  const handleContextMenu = (entry: FileEntry, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!selectedPaths.includes(entry.path)) {
      setSelectedPaths([entry.path]);
      setLastSelectedPath(entry.path);
    }
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  };

  const handleFileAreaKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      handleSelectAll();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      handleInvertSelection();
      return;
    }
    if (event.key === 'Escape') {
      setSelectedPaths([]);
      setContextMenu(null);
      setLastSelectedPath(null);
    }
    if (event.key === 'Enter' && selectedEntries.length === 1) {
      if (selectedEntries[0].type === 'directory') {
        setCurrentPath(selectedEntries[0].path);
      } else {
        handlePreview();
      }
    }
  };

  const handleFileAreaClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setContextMenu(null);
  };

  const handleWorkspaceClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setContextMenu(null);
  };

  const handleFileAreaDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (canWrite && event.dataTransfer.types.includes('Files')) {
      setDraggingUpload(true);
    }
  };

  const handleFileAreaDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDraggingUpload(false);
    }
  };

  const handleFileAreaDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDraggingUpload(false);
    if (!canWrite) {
      return;
    }
    handleUploadFiles(event.dataTransfer.files);
  };

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('resize', closeContextMenu);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, []);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) {
      return [];
    }
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((part, index) => ({
      label: part,
      path: `/${parts.slice(0, index + 1).join('/')}`
    }));
  }, [currentPath]);

  if (sessionLoading) {
    return <div className="auth-shell">Loading...</div>;
  }

  if (session?.authEnabled && !session.authenticated) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />;
  }

  const shell = (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={appIcon} alt="" />
          <div>
            <strong>Volum</strong>
            <span>File manager</span>
            {session?.authEnabled && <span>{session.role}</span>}
          </div>
        </div>

        <section className="nav-section">
          <h2>Storage</h2>
          <div className="root-list">
            {roots.map((root) => (
              <button
                className={root.path === currentPath ? 'root-item active' : 'root-item'}
                key={root.path}
                onClick={() => setCurrentPath(root.path)}
                type="button"
              >
                <DeviceIcon name="drive-harddisk" size={18} />
                <span className="root-details">
                  <span>{root.path}</span>
                  <small>{formatRootUsage(root)}</small>
                  {root.totalBytes > 0 && (
                    <span className="root-meter" aria-hidden="true">
                      <span style={{ width: `${Math.min((root.usedBytes / root.totalBytes) * 100, 100)}%` }} />
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace" onClick={handleWorkspaceClick}>
        <header className="topbar">
          {selectedEntries.length > 0 ? (
            <div className="selection-bar">
              <span>{selectedEntries.length} selected</span>
              <div className="selection-actions">
                <button type="button" onClick={handleSelectAll} disabled={!canSelect}>
                  <Icon name="selection-select-all" size={16} />
                  Select all
                </button>
                <button type="button" onClick={handleInvertSelection} disabled={!canSelect}>
                  <Icon name="selection-invert" size={16} />
                  Invert
                </button>
                {canPreview && (
                  <button type="button" onClick={handlePreview}>
                    <Icon name="view-preview" size={16} />
                    Preview
                  </button>
                )}
                {canDownload && (
                  <button type="button" onClick={handleDownload}>
                    <Icon name="edit-download" size={16} />
                    Download
                  </button>
                )}
                {canRename && canWrite && (
                  <button type="button" onClick={handleRename}>
                    <Icon name="edit-rename" size={16} />
                    Rename
                  </button>
                )}
                {canCopy && canWrite && (
                  <button type="button" onClick={handleCopy}>
                    <Icon name="edit-copy" size={16} />
                    Copy
                  </button>
                )}
                {canMove && canWrite && (
                  <button type="button" onClick={handleMove}>
                    <Icon name="edit-cut" size={16} />
                    Move
                  </button>
                )}
                {canDelete && canWrite && (
                  <button type="button" onClick={handleDelete} className="danger">
                    <Icon name="edit-delete" size={16} />
                    Delete
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setSelectedPaths([])}>
                Clear
              </button>
            </div>
          ) : (
            <>
              <nav className="breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                  <button key={crumb.path} onClick={() => setCurrentPath(crumb.path)} type="button">
                    {index > 0 && <Icon name="go-next" size={16} />}
                    <span>{crumb.label}</span>
                  </button>
                ))}
              </nav>

              <div className="toolbar">
                <button
                  className="icon-button"
                  disabled={!canWrite}
                  onClick={handleCreateFolder}
                  title="Create folder"
                  type="button"
                >
                  <Icon name="folder-new" size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!canWrite}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload files"
                  type="button"
                >
                  <Icon name="document-import" size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  className="hidden-file-input"
                  multiple
                  type="file"
                  onChange={(event) => {
                    if (event.currentTarget.files) {
                      handleUploadFiles(event.currentTarget.files);
                      event.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  className="icon-button"
                  disabled={!canSelect}
                  onClick={handleSelectAll}
                  title="Select all"
                  type="button"
                >
                  <Icon name="selection-select-all" size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!canSelect}
                  onClick={handleInvertSelection}
                  title="Invert selection"
                  type="button"
                >
                  <Icon name="selection-invert" size={18} />
                </button>
                <label className="search">
                  <Icon name="edit-find" size={16} />
                  <input
                    placeholder="Search this folder"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  className="sort-select"
                  value={`${sortField}:${sortDirection}`}
                  onChange={(event) => {
                    const [field, direction] = event.target.value.split(':') as [SortField, SortDirection];
                    setSortField(field);
                    setSortDirection(direction);
                  }}
                  title="Sort files"
                >
                  <option value="name:asc">Name A-Z</option>
                  <option value="name:desc">Name Z-A</option>
                  <option value="size:asc">Size small first</option>
                  <option value="size:desc">Size large first</option>
                  <option value="type:asc">Type A-Z</option>
                  <option value="type:desc">Type Z-A</option>
                  <option value="modifiedAt:desc">Newest first</option>
                  <option value="modifiedAt:asc">Oldest first</option>
                </select>
                <button
                  className="icon-button"
                  onClick={() => setShowHidden((value) => !value)}
                  title="Toggle hidden files"
                  type="button"
                >
                  <Icon name="view-hidden" size={18} />
                </button>
                <button
                  className="icon-button"
                  onClick={refresh}
                  title="Refresh"
                  type="button"
                >
                  <Icon name="view-refresh" size={18} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  title="Change view"
                  type="button"
                >
                  {viewMode === 'list' ? (
                    <Icon name="view-grid" size={18} />
                  ) : (
                    <Icon name="view-list-tree" size={18} />
                  )}
                </button>
                {session?.authEnabled && (
                  <button
                    className="icon-button"
                    onClick={handleLogout}
                    title="Log out"
                    type="button"
                  >
                    <Icon name="system-log-out" size={18} />
                  </button>
                )}
              </div>
            </>
          )}
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section
          className={`${viewMode === 'grid' ? 'file-grid' : 'file-list'}${draggingUpload ? ' drag-over' : ''}`}
          onDragLeave={handleFileAreaDragLeave}
          onDragOver={handleFileAreaDragOver}
          onDrop={handleFileAreaDrop}
          onClick={handleFileAreaClick}
          onKeyDown={handleFileAreaKeyDown}
          tabIndex={0}
        >
          {loading ? (
            <div className="empty-state">Loading folder...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">No files found in {currentPath}</div>
          ) : (
            filteredEntries.map((entry) => {
              const fileIconSize = viewMode === 'grid' ? 84 : 28;
              return (
                <button
                  className={selectedPaths.includes(entry.path) ? 'file-row selected' : 'file-row'}
                  key={entry.path}
                  onClick={(event) => handleSelectEntry(entry, event)}
                  onContextMenu={(event) => handleContextMenu(entry, event)}
                  onDoubleClick={() => {
                    if (entry.type === 'directory') {
                      setCurrentPath(entry.path);
                      return;
                    }
                    const ext = entry.name.toLowerCase();
                    if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext)) {
                      setPreviewEntry(entry);
                    } else {
                      window.open(downloadUrl(entry.path), '_blank');
                    }
                  }}
                  type="button"
                >
                  {entry.type === 'directory' ? (
                    <FolderIcon size={fileIconSize} />
                  ) : (
                    <FileIcon entry={entry} size={fileIconSize} />
                  )}
                  <span className="file-name">{entry.name}</span>
                  {viewMode === 'grid' && (
                    <span className="file-meta">
                      {formatBytes(entry.size)}
                      <span>{formatGridDate(entry.modifiedAt)}</span>
                    </span>
                  )}
                  {viewMode === 'list' && (
                    <>
                      <span>{entry.type}</span>
                      <span>{formatBytes(entry.size)}</span>
                      <span>{new Date(entry.modifiedAt).toLocaleString()}</span>
                      <span>{entry.permissions}</span>
                    </>
                  )}
                </button>
              );
            })
          )}
        </section>

        {contextMenu && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={handleRename} disabled={!canWrite || !canRename}>
              <Icon name="edit-rename" size={16} />
              Rename
            </button>
            <button type="button" onClick={handleDownload} disabled={!canDownload}>
              <Icon name="edit-download" size={16} />
              Download
            </button>
            <button type="button" onClick={handlePreview} disabled={!canPreview}>
              <Icon name="view-preview" size={16} />
              Preview
            </button>
            <button type="button" onClick={handleCopy} disabled={!canWrite || !canCopy}>
              <Icon name="edit-copy" size={16} />
              Copy
            </button>
            <button type="button" onClick={handleMove} disabled={!canWrite || !canMove}>
              <Icon name="edit-cut" size={16} />
              Move
            </button>
            <button type="button" className="danger" onClick={handleDelete} disabled={!canWrite || !canDelete}>
              <Icon name="edit-delete" size={16} />
              Delete
            </button>
          </div>
        )}
      </section>

      <aside className="job-drawer">
        <div className="drawer-header">
          <h2>Jobs</h2>
          <span>{jobs.length}</span>
        </div>
        <div className="job-list">
          {jobs.length === 0 ? (
            <p className="muted">No jobs yet</p>
          ) : (
            jobs.map((job) => (
              <JobItem
                job={job}
                key={job.id}
                onCancel={handleCancelJob}
                onPause={handlePauseJob}
                onResume={handleResumeJob}
                onRetry={handleRetryJob}
              />
            ))
          )}
        </div>
      </aside>
    </main>
  );

  if (previewEntry) {
    return (
      <>
        {shell}
        <PreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} />
      </>
    );
  }

  return shell;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [role, setRole] = useState<'admin' | 'readonly'>('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    login(role, password)
      .then(onLoggedIn)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className="auth-shell">
      <form className="login-panel" onSubmit={handleSubmit}>
        <img className="brand-mark" src={appIcon} alt="" />
        <h1>Volum</h1>
        <select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'readonly')}>
          <option value="admin">Admin</option>
          <option value="readonly">Readonly</option>
        </select>
        <input
          autoFocus
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="login-error">{error}</p>}
        <button disabled={submitting || password.length === 0} type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}

function JobItem({
  job,
  onCancel,
  onPause,
  onResume,
  onRetry
}: {
  job: Job;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const progress = job.totalBytes > 0 ? Math.round((job.processedBytes / job.totalBytes) * 100) : 0;
  const canCancel = job.status === 'queued' || job.status === 'running' || job.status === 'paused';
  const canPause = job.status === 'running';
  const canResume = job.status === 'paused';
  const canRetry = job.status === 'failed' || job.status === 'cancelled';
  const showLiveStats = job.status === 'running';
  const hasKnownTotal = job.totalBytes > 0;

  return (
    <article className="job-item">
      <div className="job-title-row">
        <strong>{job.type}</strong>
        <span>{job.status}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="job-meta">
        <span>
          {hasKnownTotal
            ? `${formatBytes(job.processedBytes)} / ${formatBytes(job.totalBytes)}`
            : `${formatBytes(job.processedBytes)} uploaded`}
        </span>
        {showLiveStats && job.speedBytesPerSecond ? <span>{formatBytes(job.speedBytesPerSecond)}/s</span> : null}
        {showLiveStats && job.etaSeconds !== undefined ? <span>{formatDuration(job.etaSeconds)} left</span> : null}
      </div>
      <p>{job.currentItem ?? job.sourcePath ?? job.id}</p>
      {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
      {(canPause || canResume || canCancel || canRetry) && (
        <div className="job-actions">
          {canPause && (
            <button type="button" onClick={() => onPause(job.id)}>
              <Icon name="media-playback-pause" size={15} />
              Pause
            </button>
          )}
          {canResume && (
            <button type="button" onClick={() => onResume(job.id)}>
              <Icon name="media-playback-start" size={15} />
              Resume
            </button>
          )}
          {canCancel && (
            <button type="button" onClick={() => onCancel(job.id)}>
              <Icon name="process-stop" size={15} />
              Cancel
            </button>
          )}
          {canRetry && (
            <button type="button" onClick={() => onRetry(job.id)}>
              <Icon name="view-refresh" size={15} />
              Retry
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function formatBytes(value: number) {
  if (value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatRootUsage(root: RootEntry) {
  if (root.totalBytes <= 0) {
    return 'Usage unavailable';
  }
  return `${formatBytes(root.usedBytes)} used of ${formatBytes(root.totalBytes)} | ${formatBytes(root.freeBytes)} free`;
}

function formatGridDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return 'less than 1s';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function promptConflictPolicy(defaultPolicy: ConflictPolicy): ConflictPolicy | null {
  const value = window.prompt('Conflict policy: ask, skip, overwrite, rename, cancel', defaultPolicy);
  if (value === null) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'ask' ||
    normalized === 'skip' ||
    normalized === 'overwrite' ||
    normalized === 'rename' ||
    normalized === 'cancel'
  ) {
    return normalized;
  }
  window.alert('Conflict policy must be ask, skip, overwrite, rename, or cancel.');
  return null;
}
