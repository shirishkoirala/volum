import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileEntry, Job, BlockDevice, RootEntry, Session, TrashEntry, SearchResult,
  getDevices, getFiles, getRoots, getTrash, searchFiles, getDirSizes,
} from '../api/client';
import { uniquePaths } from '../utils/path';

interface UseFileBrowserParams {
  currentPath: string;
  showHidden: boolean;
  session: Session;
}

export function useFileBrowser({ currentPath, showHidden, session }: UseFileBrowserParams) {
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [devices, setDevices] = useState<BlockDevice[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const pollingPathRef = useRef<string | null>(null);

  const canWrite = session.role === 'admin';

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);

  useEffect(() => {
    getRoots()
      .then((response) => setRoots(response.roots ?? []))
      .catch((err: Error) => setError(err.message));
  }, [session]);

  const loadDevices = useCallback(() => {
    setDeviceError(null);
    getDevices()
      .then((response) => setDevices(response.devices ?? []))
      .catch((err: Error) => setDeviceError(err.message));
  }, []);

  useEffect(() => { loadDevices(); }, [session, loadDevices]);

  useEffect(() => {
    if (!currentPath) return;
    setLoading(true);
    setError(null);
    getFiles(currentPath, showHidden)
      .then((response) => { setEntries(response.entries ?? []); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentPath, refreshKey, showHidden]);

  useEffect(() => {
    if (!currentPath || loading) { pollingPathRef.current = null; return; }
    if (pollingPathRef.current === currentPath) return;
    const hasPendingDir = entriesRef.current.some((e) => e.type === 'directory' && e.size === 0);
    if (!hasPendingDir) { pollingPathRef.current = null; return; }
    pollingPathRef.current = currentPath;
    const interval = setInterval(async () => {
      try {
        const response = await getDirSizes(currentPath);
        const sizes = response.sizes ?? {};
        setEntries((prev) => {
          let changed = false;
          const next = prev.map((e) => {
            const newSize = sizes[e.path];
            if (newSize !== undefined && e.size !== newSize) { changed = true; return { ...e, size: newSize }; }
            return e;
          });
          if (!changed) return prev;
          const allDone = !next.some((e) => e.type === 'directory' && e.size === 0);
          if (allDone && pollingPathRef.current === currentPath) pollingPathRef.current = null;
          return next;
        });
      } catch (e) { console.error('Dir sizes polling failed:', e); }
    }, 500);
    return () => { clearInterval(interval); if (pollingPathRef.current === currentPath) pollingPathRef.current = null; };
  }, [currentPath, loading]);

  useEffect(() => {
    getTrash()
      .then((response) => setTrashEntries(response.entries ?? []))
      .catch((err) => console.error('Failed to fetch trash:', err));
  }, [session, refreshKey]);

  const handleGlobalSearch = useCallback((searchQuery: string) => {
    if (searchQuery.trim().length < 2) { setSearchResults(null); return; }
    searchFiles(searchQuery.trim(), 20).then((response) => setSearchResults(response.results ?? [])).catch(() => setSearchResults([]));
  }, []);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? entries.filter((e) => e.name.toLowerCase().includes(needle)) : entries;
    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [entries, query]);

  const sortedTrashEntries = useMemo(() => {
    return [...trashEntries].sort((a, b) => {
      return (new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime());
    });
  }, [trashEntries]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = parts.map((part, index) => ({ label: part, path: `/${parts.slice(0, index + 1).join('/')}` }));
    if (crumbs.length === 0) return [{ label: '/', path: '/' }];
    return crumbs;
  }, [currentPath]);

  const folderSuggestions = useMemo(
    () => uniquePaths([currentPath, ...roots.map((r) => r.path), ...devices.flatMap((d) => (d.partitions ?? []).filter((p) => p.volumPath).map((p) => p.volumPath!))]),
    [currentPath, roots, devices]
  );

  const currentRoot = useMemo(() => {
    if (!currentPath) return null;
    return roots.find((r) => currentPath.startsWith(r.path)) ?? null;
  }, [currentPath, roots]);

  const selectedFileBytes = useMemo(() => {
    let total = 0;
    entries.forEach((entry) => { if (entry.size) total += entry.size; });
    return total;
  }, [entries]);

  return {
    entries, setEntries,
    trashEntries, setTrashEntries,
    jobs, setJobs,
    roots,
    devices, deviceError, loadDevices,
    loading, error, setError,
    query, setQuery,
    searchOpen, setSearchOpen,
    searchResults, setSearchResults,
    filteredEntries,
    sortedTrashEntries,
    breadcrumbs,
    folderSuggestions,
    currentRoot,
    selectedFileBytes,
    canWrite,
    refresh,
    handleGlobalSearch,
    entriesRef,
  };
}
