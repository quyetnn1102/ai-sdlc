/**
 * Generic data-fetching hook.
 * Fires on mount and whenever `key` changes (set key=null to skip).
 */
import { useState, useEffect, useCallback } from 'react';
import { ApiError } from './api';

export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQuery<T>(
  fetcher: (() => Promise<T>) | null,
  deps: unknown[] = [],
): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    if (!fetcher) return;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : 'Unexpected error';
        setError(msg);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, ...deps]);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refetch: run };
}
