import { type DependencyList, useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Clear the entire in-memory cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Invalidate cache entries matching a substring or regular expression, or all entries.
 */
export function invalidateCache(pattern?: string | RegExp): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
      cache.delete(key);
    }
  }
}

function serializeDeps(deps: DependencyList): string {
  return deps
    .map((dep) => {
      if (dep === null) return 'null';
      if (dep === undefined) return 'undefined';
      if (typeof dep === 'number' || typeof dep === 'boolean' || typeof dep === 'string') {
        return String(dep);
      }
      return '';
    })
    .join('::');
}

export interface UseLoadOptions {
  ttl?: number;
}

/**
 * SWR-enabled data loader hook.
 * Returns cached data immediately (0ms) if available, while refreshing in the background.
 */
export function useLoad<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options?: UseLoadOptions,
) {
  const cacheKey = serializeDeps(deps);
  const ttl = options?.ttl ?? 60_000;

  const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;

  const [data, setData] = useState<T | undefined>(() => cached?.data);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !cached);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => {
    cache.delete(cacheKey);
    setRevision((n) => n + 1);
  }, [cacheKey]);

  useEffect(() => {
    let alive = true;
    const currentCached = cache.get(cacheKey) as CacheEntry<T> | undefined;
    const isFresh = currentCached && Date.now() - currentCached.timestamp < ttl;

    if (currentCached) {
      setData(currentCached.data);
      setLoading(false);
    }

    if (!isFresh || revision > 0) {
      if (!currentCached) {
        setLoading(true);
      }
      setError('');
      loader()
        .then((value) => {
          cache.set(cacheKey, { data: value, timestamp: Date.now() });
          if (alive) {
            setData(value);
            setError('');
          }
        })
        .catch((e) => {
          if (alive) setError(errorMessage(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }

    return () => {
      alive = false;
    };
  }, [...deps, revision, cacheKey, ttl]);

  return { data, error, loading, reload };
}
