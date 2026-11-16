import { useEffect, useState } from 'react';
import { userService } from '@/services';
import type { User } from '@/types/models';

export function useUserSearch(query: string) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setUsers(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      userService
        .searchUsers(q)
        .then((u) => !cancelled && (setUsers(u), setError(null)))
        .catch(() => !cancelled && setError('Search failed. Please try again.'))
        .finally(() => !cancelled && setLoading(false));
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { users, loading, error };
}