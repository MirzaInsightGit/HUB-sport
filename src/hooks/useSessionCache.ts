import { useEffect, useState } from 'react';
import { getCache, setCache } from '../utils/sessionCache';

export function useSessionCache<T>(fullKey: string, fetcher: () => Promise<T>, ttlMs = 5*60*1000) {
  const [data, setData] = useState<T | null>(() => getCache<T>(fullKey));
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    let mounted = true;
    if (!data) {
      setLoading(true);
      fetcher().then(d => {
        if (!mounted) return;
        setData(d);
        setCache(fullKey, d, ttlMs);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const refresh = async () => {
    const d = await fetcher();
    setData(d);
    setCache(fullKey, d, ttlMs);
  };
  return { data, loading, refresh };
}