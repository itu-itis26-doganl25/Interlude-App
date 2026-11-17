import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/ui/Artwork';
import { MediaRow } from '@/components/ui/MediaRow';
import { colors, spacing, typography } from '@/constants/theme';
import { usePlayer } from '@/providers/PlayerProvider';

export function QueueList() {
  const { queue, currentIndex, autoplay, setAutoplay, playQueueItem } = usePlayer();

  // Keep each item's absolute queue index so pressing it jumps to the right place.
  const upcoming = queue
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index > currentIndex);
  const userItems = upcoming.filter(({ item }) => item.source === 'user');
  const recommended = upcoming.filter(({ item }) => item.source === 'recommended');

  const renderRows = (rows: typeof upcoming) =>
    rows.map(({ item, index }) => (
      <MediaRow
        key={`${item.song.id}-${index}`}
        title={item.song.title}
        subtitle={item.song.artistName}
        leading={<Artwork uri={item.song.coverUrl} seed={item.song.id} size={44} />}
        onPress={() => playQueueItem(index)}
      />
    ));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Autoplay"
        accessibilityState={{ checked: autoplay }}
        onPress={() => setAutoplay(!autoplay)}
        style={styles.autoplayRow}
      >
        <View style={styles.autoplayTexts}>
          <Text style={styles.autoplayTitle}>Autoplay</Text>
          <Text style={styles.autoplayHint}>Keep playing similar songs when your queue ends</Text>
        </View>
        <View style={[styles.track, autoplay && styles.trackOn]}>
          <View style={[styles.knob, autoplay && styles.knobOn]} />
        </View>
      </Pressable>

      {userItems.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Next in queue</Text>
          {renderRows(userItems)}
        </>
      ) : null}

      {recommended.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Recommended</Text>
          {renderRows(recommended)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing.lg },
  autoplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  autoplayTexts: { flex: 1 },
  autoplayTitle: { ...typography.subtitle, color: colors.textPrimary },
  autoplayHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textPrimary },
  knobOn: { alignSelf: 'flex-end' },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
});
