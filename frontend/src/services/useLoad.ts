import { type DependencyList, useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

export function useLoad<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loader()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [...deps, revision]);
  return { data, error, loading, reload };
}
