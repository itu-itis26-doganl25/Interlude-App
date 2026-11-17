import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/ui/Artwork';
import { colors, spacing, typography } from '@/constants/theme';
import { usePlayer } from '@/providers/PlayerProvider';

/** Sits above the tab bar. Renders nothing until something is playing. */
export function MiniPlayer() {
  const router = useRouter();
  const { currentSong, isPlaying, positionMs, toggle } = usePlayer();

  if (!currentSong) return null;

  const fraction =
    currentSong.durationMs > 0 ? Math.min(Math.max(positionMs / currentSong.durationMs, 0), 1) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/player')}
      style={styles.container}
    >
      <View style={styles.row}>
        <Artwork uri={currentSong.coverUrl} seed={currentSong.id} size={40} />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {currentSong.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentSong.artistName}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          onPress={toggle}
          hitSlop={8}
          style={styles.playButton}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: currentSong.durationMs, now: positionMs }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  artist: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  texts: { flex: 1 },
  playButton: { padding: 6 },
  progressTrack: { height: 2, backgroundColor: colors.border },
  progressFill: { height: '100%', backgroundColor: colors.primary },
});
