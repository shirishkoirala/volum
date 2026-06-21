import { useState, useEffect, useCallback, useRef } from 'react';

type UseAsyncDataResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useAsyncData<T>(fetcher: () => Promise<T>): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcherRef.current()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'An error occurred'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
