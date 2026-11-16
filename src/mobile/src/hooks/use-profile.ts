import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { userService, UserProfile } from '@/services';

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await userService.getProfile(userId));
      setError(null);
    } catch {
      setError('Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Ekrana her dönüşte yenile (başkasını takip edince sayılar güncel kalsın)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Optimistic update: önce arayüzü güncelle, hata olursa geri al
  const toggleFollow = useCallback(async () => {
    if (!profile) return;
    const next = !profile.isFollowing;
    const apply = (follow: boolean) =>
      setProfile((p) =>
        p ? { ...p, isFollowing: follow, followerCount: p.followerCount + (follow ? 1 : -1) } : p,
      );
    apply(next);
    try {
      await userService.setFollowing(userId, next);
    } catch {
      apply(!next);
    }
  }, [profile, userId]);

  return { profile, loading, error, retry: load, toggleFollow };
}