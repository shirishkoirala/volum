import { KeyboardEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Copy,
  Download,
  File,
  Folder,
  Grid2X2,
  HardDrive,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2
} from 'lucide-react';
import {
  FileEntry,
  Job,
  createCopyJob,
  createFolder,
  deletePath,
  downloadUrl,
  getFiles,
  getJobs,
  getRoots,
  renamePath
} from './api/client';

type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';
type ContextMenuState = {
  x: number;
  y: number;
  entry: FileEntry;
} | null;

export function App() {
  const [roots, setRoots] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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

  useEffect(() => {
    getRoots()
      .then((response) => {
        const safeRoots = response.roots ?? [];
        setRoots(safeRoots);
        setCurrentPath(safeRoots[0] ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, []);

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
        await deletePath(entry.path);
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

  useEffect(() => {
    const loadJobs = () => {
      getJobs()
        .then((response) => setJobs(response.jobs ?? []))
        .catch(() => undefined);
    };
    loadJobs();
    const timer = window.setInterval(loadJobs, 5000);
    return () => window.clearInterval(timer);
  }, []);

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

  const handleCopy = () => {
    if (!canCopy) {
      return;
    }
    const destinationFolder = window.prompt('Destination folder path', currentPath);
    if (destinationFolder === null || destinationFolder.trim() === '') {
      return;
    }
    const targetFolder = destinationFolder.trim().replace(/\/+$/, '');
    void runAction(async () => {
      for (const entry of selectedEntries) {
        await createCopyJob(entry.path, `${targetFolder}/${entry.name}`);
      }
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
      setSelectedPaths((paths) =>
        paths.includes(entry.path) ? paths.filter((path) => path !== entry.path) : [...paths, entry.path]
      );
      setLastSelectedPath(entry.path);
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
    if (event.key === 'Escape') {
      setSelectedPaths([]);
      setContextMenu(null);
    }
    if (event.key === 'Enter' && selectedEntries.length === 1 && selectedEntries[0].type === 'directory') {
      setCurrentPath(selectedEntries[0].path);
    }
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>Volum</strong>
            <span>File manager</span>
          </div>
        </div>

        <section className="nav-section">
          <h2>Storage</h2>
          <div className="root-list">
            {roots.map((root) => (
              <button
                className={root === currentPath ? 'root-item active' : 'root-item'}
                key={root}
                onClick={() => setCurrentPath(root)}
                type="button"
              >
                <HardDrive size={18} />
                <span>{root}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <button key={crumb.path} onClick={() => setCurrentPath(crumb.path)} type="button">
                {index > 0 && <ChevronRight size={16} />}
                <span>{crumb.label}</span>
              </button>
            ))}
          </nav>

          <div className="toolbar">
            <button
              className="icon-button"
              onClick={handleCreateFolder}
              title="Create folder"
              type="button"
            >
              <Plus size={18} />
            </button>
            <button
              className="icon-button"
              disabled={!canRename}
              onClick={handleRename}
              title="Rename selected item"
              type="button"
            >
              <Pencil size={18} />
            </button>
            <button
              className="icon-button"
              disabled={!canDownload}
              onClick={handleDownload}
              title="Download selected file"
              type="button"
            >
              <Download size={18} />
            </button>
            <button
              className="icon-button"
              disabled={!canCopy}
              onClick={handleCopy}
              title="Copy selected item"
              type="button"
            >
              <Copy size={18} />
            </button>
            <button
              className="icon-button danger"
              disabled={!canDelete}
              onClick={handleDelete}
              title="Delete selected item"
              type="button"
            >
              <Trash2 size={18} />
            </button>
            <label className="search">
              <Search size={16} />
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
              <Settings2 size={18} />
            </button>
            <button
              className="icon-button"
              onClick={refresh}
              title="Refresh"
              type="button"
            >
              <RefreshCw size={18} />
            </button>
            <button
              className="icon-button"
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              title="Change view"
              type="button"
            >
              {viewMode === 'list' ? <Grid2X2 size={18} /> : <List size={18} />}
            </button>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}
        {selectedEntries.length > 0 && (
          <div className="selection-bar">
            <span>{selectedEntries.length} selected</span>
            <button type="button" onClick={() => setSelectedPaths([])}>
              Clear
            </button>
          </div>
        )}

        <section
          className={viewMode === 'grid' ? 'file-grid' : 'file-list'}
          onKeyDown={handleFileAreaKeyDown}
          tabIndex={0}
        >
          {loading ? (
            <div className="empty-state">Loading folder...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">No files found in {currentPath}</div>
          ) : (
            filteredEntries.map((entry) => (
              <button
                className={selectedPaths.includes(entry.path) ? 'file-row selected' : 'file-row'}
                key={entry.path}
                onClick={(event) => handleSelectEntry(entry, event)}
                onContextMenu={(event) => handleContextMenu(entry, event)}
                onDoubleClick={() => entry.type === 'directory' && setCurrentPath(entry.path)}
                type="button"
              >
                {entry.type === 'directory' ? <Folder size={22} /> : <File size={22} />}
                <span className="file-name">{entry.name}</span>
                <span>{entry.type}</span>
                <span>{formatBytes(entry.size)}</span>
                <span>{new Date(entry.modifiedAt).toLocaleString()}</span>
                <span>{entry.permissions}</span>
              </button>
            ))
          )}
        </section>

        {contextMenu && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={handleRename} disabled={!canRename}>
              <Pencil size={16} />
              Rename
            </button>
            <button type="button" onClick={handleDownload} disabled={!canDownload}>
              <Download size={16} />
              Download
            </button>
            <button type="button" onClick={handleCopy} disabled={!canCopy}>
              <Copy size={16} />
              Copy
            </button>
            <button type="button" className="danger" onClick={handleDelete} disabled={!canDelete}>
              <Trash2 size={16} />
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
            jobs.map((job) => <JobItem job={job} key={job.id} />)
          )}
        </div>
      </aside>
    </main>
  );
}

function JobItem({ job }: { job: Job }) {
  const progress = job.totalBytes > 0 ? Math.round((job.processedBytes / job.totalBytes) * 100) : 0;

  return (
    <article className="job-item">
      <div>
        <strong>{job.type}</strong>
        <span>{job.status}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p>{job.currentItem ?? job.sourcePath ?? job.id}</p>
      {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
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
