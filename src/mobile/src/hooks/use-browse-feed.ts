import { useCallback, useEffect, useState } from 'react';
import { BrowseFeed, musicService } from '@/services';

export function useBrowseFeed() {
  const [data, setData] = useState<BrowseFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setData(await musicService.getBrowseFeed());
      setError(null);
    } catch {
      setError('Could not load music. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load('initial');
  }, [load]);

  const refresh = useCallback(() => load('refresh'), [load]);
  const retry = useCallback(() => load('initial'), [load]);

  return { data, loading, refreshing, error, refresh, retry };
}