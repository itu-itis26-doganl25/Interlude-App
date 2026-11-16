import { useEffect, useState } from 'react';
import { ConnectionKind, userService } from '@/services';
import type { User } from '@/types/models';

export function useConnections(userId: string, kind: ConnectionKind) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    userService
      .getConnections(userId, kind)
      .then((u) => !cancelled && (setUsers(u), setError(null)))
      .catch(() => !cancelled && setError('Could not load this list.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  return { users, loading, error };
}