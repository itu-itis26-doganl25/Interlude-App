import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterChips } from '@/components/library/FilterChips';
import { Artwork } from '@/components/ui/Artwork';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MediaRow } from '@/components/ui/MediaRow';
import { colors, spacing, typography } from '@/constants/theme';
import { useLibrary } from '@/providers/LibraryProvider';
import { usePlayer } from '@/providers/PlayerProvider';

type Filter = 'songs' | 'albums' | 'artists' | 'playlists';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'songs', label: 'Songs' },
  { value: 'albums', label: 'Albums' },
  { value: 'artists', label: 'Artists' },
  { value: 'playlists', label: 'Playlists' },
];

const EMPTY_TEXT: Record<Filter, string> = {
  songs: 'No liked songs yet.',
  albums: 'No saved albums yet.',
  artists: 'You are not following any artists yet.',
  playlists: 'No playlists yet.',
};

const ART_SIZE = 48;

export default function LibraryScreen() {
  const router = useRouter();
  const { library, loading, error, retry } = useLibrary();
  const { play } = usePlayer();
  const [filter, setFilter] = useState<Filter>('songs');

  const renderBody = () => {
    if (!library) {
      if (error) {
        return (
          <View style={styles.center}>
            <Text style={styles.message}>{error}</Text>
            <Button title="Try again" variant="secondary" onPress={retry} />
          </View>
        );
      }
      return (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      );
    }

    const rows = {
      songs: library.likedSongs.map((song) => (
        <MediaRow
          key={song.id}
          title={song.title}
          subtitle={song.artistName}
          leading={<Artwork uri={song.coverUrl} seed={song.id} size={ART_SIZE} />}
          onPress={() => play(song, library.likedSongs)}
        />
      )),
      albums: library.savedAlbums.map((album) => (
        <MediaRow
          key={album.id}
          title={album.title}
          subtitle={album.artistName}
          leading={<Artwork uri={album.coverUrl} seed={album.id} size={ART_SIZE} />}
        />
      )),
      artists: library.followedArtists.map((artist) => (
        <MediaRow
          key={artist.id}
          title={artist.displayName}
          subtitle="Artist"
          leading={
            <Avatar uri={artist.avatarUrl} name={artist.displayName} seed={artist.id} size={ART_SIZE} />
          }
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: artist.id } })}
        />
      )),
      playlists: library.playlists.map((playlist) => (
        <MediaRow
          key={playlist.id}
          title={playlist.name}
          subtitle={`${playlist.songIds.length} ${playlist.songIds.length === 1 ? 'song' : 'songs'}`}
          leading={<Artwork uri={playlist.coverUrl} seed={playlist.id} size={ART_SIZE} />}
        />
      )),
    }[filter];

    if (rows.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.message}>{EMPTY_TEXT[filter]}</Text>
        </View>
      );
    }
    return <ScrollView contentContainerStyle={styles.list}>{rows}</ScrollView>;
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New playlist"
          hitSlop={8}
          onPress={() => Alert.alert('New playlist', 'Creating playlists is coming in the next update.')}
        >
          <Ionicons name="add" size={28} color={colors.textPrimary} />
        </Pressable>
      </View>
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.textPrimary },
  list: { paddingVertical: spacing.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});