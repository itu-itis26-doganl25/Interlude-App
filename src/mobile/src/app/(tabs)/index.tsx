import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlbumRow } from '@/components/AlbumRow';
import { ArtistRow } from '@/components/ArtistRow';
import { RoomCard } from '@/components/RoomCard';
import { SectionHeader } from '@/components/SectionHeader';
import { SongRow } from '@/components/SongRow';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { colors, spacing, typography } from '@/constants/theme';
import { useBrowseFeed } from '@/hooks/use-browse-feed';
import { useSearch } from '@/hooks/use-search';
import type { LiveRoom } from '@/services';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';

// TODO (Player / Rooms adımları): gerçek navigasyon ve çalma
const noop = () => {};

function RoomStrip({ rooms }: { rooms: LiveRoom[] }) {
  return (
    <FlatList
      horizontal
      data={rooms}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <RoomCard room={item} onPress={noop} />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    />
  );
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');
  const feed = useBrowseFeed();
  const search = useSearch(query);
  const isSearching = query.trim().length > 0;
  const { user } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            enabled={!isSearching}
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.greetingRow}>
            <Pressable
              onPress={() => router.navigate('/profile')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <Avatar
                uri={user?.avatarUrl ?? null}
                name={user?.displayName ?? ''}
                seed={user?.id ?? ''}
                size={44}
              />
            </Pressable>
            <Text style={styles.heading} numberOfLines={1} adjustsFontSizeToFit>
              Hi, {user?.displayName}!
            </Text>
          </View>

          <SearchBar value={query} onChangeText={setQuery} />
        </View>

        {isSearching ? (
          <SearchView {...search} />
        ) : (
          <FeedView {...feed} />
        )}
      </ScrollView>
    </View>
  );
}

function FeedView({ data, loading, error, retry }: ReturnType<typeof useBrowseFeed>) {
  if (loading && !data) return <ActivityIndicator style={styles.loader} color={colors.primary} />;

  if (error && !data) {
    return (
      <View style={styles.message}>
        <Text style={styles.messageText}>{error}</Text>
        <Button title="Try again" variant="secondary" onPress={retry} />
      </View>
    );
  }
  if (!data) return null;

  return (
    <View style={styles.sections}>
      <View>
        <SectionHeader title="Live rooms" subtitle="Listen together, right now" />
        <RoomStrip rooms={data.liveRooms} />
      </View>

      <View>
        <SectionHeader title="Trending" />
        {data.trendingSongs.map((s) => (
          <SongRow key={s.id} song={s} onPress={noop} />
        ))}
      </View>

      <View>
        <SectionHeader title="New releases" />
        {data.newReleases.map((a) => (
          <AlbumRow key={a.id} album={a} onPress={noop} />
        ))}
      </View>
    </View>
  );
}

function SearchView({ results, loading, error }: ReturnType<typeof useSearch>) {
  if (error) {
    return (
      <View style={styles.message}>
        <Text style={styles.messageText}>{error}</Text>
      </View>
    );
  }
  if (!results) return <ActivityIndicator style={styles.loader} color={colors.primary} />;

  const empty =
    !results.songs.length && !results.albums.length && !results.artists.length && !results.rooms.length;

  if (empty) {
    return (
      <View style={styles.message}>
        <Text style={styles.messageText}>No results found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.sections, loading && styles.stale]}>
      {results.songs.length > 0 && (
        <View>
          <SectionHeader title="Songs" />
          {results.songs.map((s) => <SongRow key={s.id} song={s} onPress={noop} />)}
        </View>
      )}
      {results.artists.length > 0 && (
        <View>
          <SectionHeader title="Artists" />
          {results.artists.map((a) => <ArtistRow key={a.id} artist={a} onPress={noop} />)}
        </View>
      )}
      {results.albums.length > 0 && (
        <View>
          <SectionHeader title="Albums" />
          {results.albums.map((a) => <AlbumRow key={a.id} album={a} onPress={noop} />)}
        </View>
      )}
      {results.rooms.length > 0 && (
        <View>
          <SectionHeader title="Rooms" />
          <RoomStrip rooms={results.rooms} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginBottom: spacing.xl },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heading: { flex: 1, ...typography.display, color: colors.textPrimary },
  sections: { gap: spacing.xxl },
  stale: { opacity: 0.6 },
  strip: { paddingHorizontal: spacing.xl, gap: spacing.md },
  loader: { marginTop: spacing.xxxl },
  message: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  messageText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});