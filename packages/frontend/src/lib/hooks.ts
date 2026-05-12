/**
 * Generic data-fetching hook.
 * Fires on mount and whenever `deps` changes.
 * The fetcher function reference is intentionally excluded from deps
 * to avoid infinite re-render loops when callers pass inline arrow functions.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [loading, setLoading] = useState(!!fetcher);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the latest fetcher so run() always calls the current one
  // without needing it in the dependency array
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Increment to trigger a manual refetch
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const fn = fetcherRef.current;
    if (!fn) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fn()
      .then((d) => {
        if (!cancelled) { setData(d); setLoading(false); }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof ApiError ? e.message : 'Unexpected error';
          setError(msg);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refetch };
}
