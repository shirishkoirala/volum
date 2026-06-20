import { useState, useEffect, useCallback } from 'react';

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

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'An error occurred'))
      .finally(() => setLoading(false));
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
