import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlayerControls } from '@/components/player/PlayerControls';
import { QueueList } from '@/components/player/QueueList';
import { SeekBar } from '@/components/player/SeekBar';
import { Artwork } from '@/components/ui/Artwork';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLibrary } from '@/providers/LibraryProvider';
import { usePlayer } from '@/providers/PlayerProvider';

export default function PlayerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { currentSong, positionMs, seek } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();
  const [showQueue, setShowQueue] = useState(false);

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close player"
      hitSlop={8}
      onPress={() => router.back()}
    >
      <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
    </Pressable>
  );

  if (!currentSong) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>{closeButton}</View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing is playing</Text>
        </View>
      </SafeAreaView>
    );
  }

  const liked = isLiked(currentSong.id);
  const artworkSize = Math.min(width - spacing.xxxl, 340);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        {closeButton}
        <Text style={styles.topLabel}>Now playing</Text>
        <View style={styles.sideSlot} />
      </View>

      <View style={styles.stage}>
        <Artwork uri={currentSong.coverUrl} seed={currentSong.id} size={artworkSize} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={styles.title} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: currentSong.artistId } })}
            >
              <Text style={styles.artist} numberOfLines={1}>
                {currentSong.artistName}
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            hitSlop={8}
            onPress={() => toggleLike(currentSong)}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={28}
              color={liked ? colors.primary : colors.textPrimary}
            />
          </Pressable>
        </View>

        <SeekBar positionMs={positionMs} durationMs={currentSong.durationMs} onSeek={seek} />
        <PlayerControls />

        {!showQueue ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Listen together"
              hitSlop={12}
              onPress={() =>
                Alert.alert('Listen together', 'Listening together arrives with Listening Rooms.')
              }
            >
              <Ionicons name="people-outline" size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Queue"
              hitSlop={12}
              onPress={() => setShowQueue(true)}
            >
              <Ionicons name="list" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {showQueue ? (
        <>
          <Pressable
            accessible={false}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={() => setShowQueue(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Queue</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close queue"
                hitSlop={12}
                onPress={() => setShowQueue(false)}
              >
                <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <QueueList />
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topLabel: { ...typography.label, color: colors.textSecondary },
  sideSlot: { width: 28 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1 },
  title: { ...typography.title, color: colors.textPrimary },
  artist: { ...typography.subtitle, fontWeight: '400', color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingBottom: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetTitle: { ...typography.subtitle, color: colors.textPrimary },
});