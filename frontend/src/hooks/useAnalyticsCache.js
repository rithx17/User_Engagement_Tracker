import { useCallback, useMemo, useRef } from 'react';

export function useAnalyticsCache() {
  const cacheRef = useRef(new Map());

  const fetchWithCache = useCallback(async (key, fetcher, options = {}) => {
    const ttlMs = options.ttlMs || 60_000;
    const force = options.force || false;
    const now = Date.now();

    if (!force) {
      const cached = cacheRef.current.get(key);
      if (cached?.promise) {
        return cached.promise;
      }
      if (cached && now - cached.ts < ttlMs) {
        return cached.value;
      }
    }

    const promise = Promise.resolve()
      .then(() => fetcher())
      .then((value) => {
        cacheRef.current.set(key, { ts: Date.now(), value });
        return value;
      })
      .catch((error) => {
        cacheRef.current.delete(key);
        throw error;
      });

    cacheRef.current.set(key, { ts: now, promise });
    return promise;
  }, []);

  const invalidate = useCallback((prefix = '') => {
    if (!prefix) {
      cacheRef.current.clear();
      return;
    }

    for (const key of cacheRef.current.keys()) {
      if (key.startsWith(prefix)) {
        cacheRef.current.delete(key);
      }
    }
  }, []);

  return useMemo(
    () => ({ fetchWithCache, invalidate }),
    [fetchWithCache, invalidate]
  );
}
