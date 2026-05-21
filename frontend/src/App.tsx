import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
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
  createFolder,
  deletePath,
  downloadUrl,
  getFiles,
  getJobs,
  getRoots,
  renamePath
} from './api/client';

type ViewMode = 'list' | 'grid';

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
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

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
    setSelectedEntry(null);
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
    if (!selectedEntry) {
      return;
    }
    const newName = window.prompt('New name', selectedEntry.name);
    if (newName === null || newName.trim() === selectedEntry.name) {
      return;
    }
    void runAction(() => renamePath(selectedEntry.path, newName.trim()));
  };

  const handleDelete = () => {
    if (!selectedEntry) {
      return;
    }
    const confirmed = window.confirm(`Delete "${selectedEntry.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    void runAction(() => deletePath(selectedEntry.path));
  };

  const handleDownload = () => {
    if (!selectedEntry || selectedEntry.type !== 'file') {
      return;
    }
    window.location.href = downloadUrl(selectedEntry.path);
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
    if (!needle) {
      return entries;
    }
    return entries.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [entries, query]);

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
              disabled={!selectedEntry}
              onClick={handleRename}
              title="Rename selected item"
              type="button"
            >
              <Pencil size={18} />
            </button>
            <button
              className="icon-button"
              disabled={!selectedEntry || selectedEntry.type !== 'file'}
              onClick={handleDownload}
              title="Download selected file"
              type="button"
            >
              <Download size={18} />
            </button>
            <button
              className="icon-button danger"
              disabled={!selectedEntry}
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

        <section className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>
          {loading ? (
            <div className="empty-state">Loading folder...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">No files found in {currentPath}</div>
          ) : (
            filteredEntries.map((entry) => (
              <button
                className={selectedEntry?.path === entry.path ? 'file-row selected' : 'file-row'}
                key={entry.path}
                onClick={() => setSelectedEntry(entry)}
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
