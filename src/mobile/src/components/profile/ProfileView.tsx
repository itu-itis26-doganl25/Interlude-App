import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlbumRow } from '@/components/AlbumRow';
import { SectionHeader } from '@/components/SectionHeader';
import { SongRow } from '@/components/SongRow';
import { StatItem } from '@/components/profile/StatItem';
import { StudioSummaryCard } from '@/components/profile/StudioSummaryCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/providers/AuthProvider';
import type { ConnectionKind } from '@/services';
import { formatCount } from '@/utils/format';
import { usePlayer } from '@/providers/PlayerProvider';

// TODO (Player / Studio adımları): gerçek navigasyon ve çalma
const noop = () => {};

interface Props {
  userId: string;
  withTopInset?: boolean; // tab ekranında true, header'lı stack ekranında false
}

export function ProfileView({ userId, withTopInset }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: me, logout, deleteAccount } = useAuth();
  const { profile, loading, error, retry, toggleFollow } = useProfile(userId);
  const isSelf = me?.id === userId;
  const { play } = usePlayer();

  const confirmDelete = () =>
  Alert.alert(
    'Delete account?',
    'This will permanently delete your account and all your data. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
          } catch {
            Alert.alert('Something went wrong', 'Your account could not be deleted. Please try again.');
          }
        },
      },
    ],
  );

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{error ?? 'Profile not found.'}</Text>
        <Button title="Try again" variant="secondary" onPress={retry} />
      </View>
    );
  }

  const { user } = profile;
  const isMusician = user.role === 'musician';
  const openConnections = (kind: ConnectionKind) =>
    router.push({ pathname: '/connections', params: { userId, kind } });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: withTopInset ? insets.top + spacing.xl : spacing.lg,
        paddingBottom: spacing.xxxl,
        gap: spacing.xxl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={user.avatarUrl} name={user.displayName} seed={user.id} size={104} />
        <Text style={styles.name} numberOfLines={1}>{user.displayName}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{isMusician ? 'Musician' : 'Listener'}</Text>
        </View>

        <View style={styles.stats}>
          <StatItem
            value={formatCount(profile.followerCount)}
            label="Followers"
            onPress={() => openConnections('followers')}
          />
          <StatItem
            value={formatCount(profile.followingCount)}
            label="Following"
            onPress={() => openConnections('following')}
          />
          <StatItem value={formatCount(profile.totalPlays)} label={isMusician ? 'Plays' : 'Listens'} />
          {isSelf && (
            <Pressable
              onPress={() => router.push('/user-search')}
              accessibilityRole="button"
              accessibilityLabel="Find people"
              style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
            >
              <Ionicons name="search" size={20} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>

        {!isSelf && (
          <Button
            title={profile.isFollowing ? 'Following' : 'Follow'}
            variant={profile.isFollowing ? 'secondary' : 'primary'}
            onPress={toggleFollow}
            style={styles.followButton}
          />
        )}
      </View>

      {/* Bio & links */}
      {(!!profile.bio || profile.links.length > 0) && (
        <View style={styles.padded}>
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {profile.links.length > 0 && (
            <View style={styles.links}>
              {profile.links.map((l) => (
                <Pressable
                  key={l.url}
                  onPress={() => Linking.openURL(l.url)}
                  style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                >
                  <Text style={styles.linkText}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Musician: Studio özeti (sadece kendi profilinde) */}
      {profile.studioSummary && (
        <View style={styles.padded}>
          <StudioSummaryCard summary={profile.studioSummary} onPress={() => router.push('/studio')} />
        </View>
      )}

      {/* Musician: popüler şarkılar ve albümler */}
      {profile.popularSongs.length > 0 && (
        <View>
          <SectionHeader title="Popular songs" />
          {profile.popularSongs.map((s) => (
            <SongRow key={s.id} song={s} onPress={(song) => play(song, profile.popularSongs)} />
          ))}
        </View>
      )}
      {profile.albums.length > 0 && (
        <View>
          <SectionHeader title="Albums" />
          {profile.albums.map((a) => <AlbumRow key={a.id} album={a} onPress={noop} />)}
        </View>
      )}

      {/* Listener: son dinlenenler ve takip edilen sanatçılar */}
      {profile.recentlyPlayed.length > 0 && (
        <View>
          <SectionHeader title="Recently played" />
          {profile.recentlyPlayed.map((s) => (
            <SongRow key={s.id} song={s} onPress={(song) => play(song, profile.recentlyPlayed)} />
          ))}
        </View>
      )}
      {profile.followedArtists.length > 0 && (
        <View>
          <SectionHeader title="Following artists" />
          <FlatList
            horizontal
            data={profile.followedArtists}
            keyExtractor={(a) => a.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Avatar uri={item.avatarUrl} name={item.displayName} seed={item.id} size={64} />
                <Text style={styles.chipName} numberOfLines={1}>{item.displayName}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {isSelf && (
        <View style={styles.padded}>
          <Button title="Log out" variant="secondary" onPress={logout} />
          <Button title="Delete account" variant="danger" onPress={confirmDelete} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  padded: { paddingHorizontal: spacing.xl, gap: spacing.md },

  header: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  name: { ...typography.display, color: colors.textPrimary, marginTop: spacing.sm },
  roleBadge: { backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  roleText: { ...typography.label, color: colors.accent },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: { alignSelf: 'stretch', marginTop: spacing.md },

  bio: { ...typography.body, color: colors.textSecondary },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  linkText: { ...typography.label, color: colors.accent },

  chips: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  chip: { alignItems: 'center', gap: spacing.sm, width: 72 },
  chipName: { ...typography.caption, color: colors.textSecondary },
});