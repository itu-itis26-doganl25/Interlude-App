import { useCallback, useEffect, useState } from 'react';
import { studioService, StudioAnalytics, StudioRange } from '@/services';

export function useStudioAnalytics(range: StudioRange) {
  const [data, setData] = useState<StudioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studioService
      .getAnalytics(range)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch(() => !cancelled && setError('Could not load analytics.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, retry };
}