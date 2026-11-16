import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/SectionHeader';
import { LineChart } from '@/components/studio/LineChart';
import { MetricCard } from '@/components/studio/MetricCard';
import { RankedRow } from '@/components/studio/RankedRow';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useStudioAnalytics } from '@/hooks/use-studio-analytics';
import type { StudioRange } from '@/services';
import { formatCount } from '@/utils/format';

const RANGES: { value: StudioRange; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<StudioRange>('7d');
  const { data, loading, error, retry } = useStudioAnalytics(range);

  const onUpload = () =>
    // TODO (WBS-14.3): dosya seçimi ve yükleme
    Alert.alert('Upload song', 'Uploading will be available once the backend is connected.');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, gap: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.padded, styles.titleRow]}>
        <Text style={styles.title}>Overview</Text>
        <Pressable
          onPress={onUpload}
          accessibilityRole="button"
          style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={colors.onPrimary} />
          <Text style={styles.uploadText}>Upload song</Text>
        </Pressable>
      </View>

      <View style={styles.padded}>
        <SegmentedControl value={range} onChange={setRange} options={RANGES} />
      </View>

      {!data && loading && <ActivityIndicator color={colors.primary} />}

      {!data && error && (
        <View style={styles.message}>
          <Text style={styles.messageText}>{error}</Text>
          <Button title="Try again" variant="secondary" onPress={retry} />
        </View>
      )}

      {data && (
        <View style={[styles.sections, loading && styles.stale]}>
          {/* Metrik kartları */}
          <View style={[styles.padded, styles.grid]}>
            <View style={styles.gridRow}>
              <MetricCard label="Total plays" metric={data.totalPlays} />
              <MetricCard label="Unique listeners" metric={data.uniqueListeners} />
            </View>
            <View style={styles.gridRow}>
              <MetricCard label="New followers" metric={data.newFollowers} />
              <MetricCard label="Avg. listened" metric={data.completionRate} format={(n) => `${n}%`} />
            </View>
          </View>

          {/* Çizgi grafik */}
          <View style={styles.padded}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Plays over time</Text>
              <LineChart data={data.playsOverTime.map((p) => p.plays)} />
              <View style={styles.axis}>
                <Text style={styles.axisText}>{shortDate(data.playsOverTime[0].date)}</Text>
                <Text style={styles.axisText}>
                  {shortDate(data.playsOverTime[data.playsOverTime.length - 1].date)}
                </Text>
              </View>
            </View>
          </View>

          {/* En çok dinlenen şarkılar */}
          <View>
            <SectionHeader title="Top songs" />
            {data.topSongs.map(({ song, plays }, i) => (
              <RankedRow
                key={song.id}
                rank={i + 1}
                title={song.title}
                subtitle={song.artistName}
                value={formatCount(plays)}
                share={plays / data.topSongs[0].plays}
                artworkSeed={song.id}
              />
            ))}
          </View>

          {/* Albüm performansı */}
          <View>
            <SectionHeader title="Album performance" />
            {data.albumPerformance.map(({ album, plays }, i) => (
              <RankedRow
                key={album.id}
                rank={i + 1}
                title={album.title}
                subtitle={`${album.songIds.length} ${album.songIds.length === 1 ? 'track' : 'tracks'}`}
                value={formatCount(plays)}
                share={plays / data.albumPerformance[0].plays}
                artworkSeed={album.id}
              />
            ))}
          </View>

          {/* Canlı oda dinlemeleri */}
          <View>
            <SectionHeader title="Live rooms" subtitle="Plays in listening rooms" />
            <View style={[styles.padded, styles.roomStats]}>
              <View style={styles.roomStat}>
                <Text style={styles.roomValue}>{formatCount(data.roomActivity.totalRoomPlays)}</Text>
                <Text style={styles.roomLabel}>room plays</Text>
              </View>
              <View style={styles.roomStat}>
                <Text style={styles.roomValue}>{data.roomActivity.roomCount}</Text>
                <Text style={styles.roomLabel}>rooms</Text>
              </View>
            </View>
            {data.roomActivity.topSongs.map(({ song, plays }, i) => (
              <RankedRow
                key={song.id}
                rank={i + 1}
                title={song.title}
                value={formatCount(plays)}
                share={plays / data.roomActivity.topSongs[0].plays}
                artworkSeed={song.id}
              />
            ))}
          </View>

          {/* Dinleyici ülkeleri */}
          <View>
            <SectionHeader title="Listener countries" />
            {data.listenerCountries.map((c, i) => (
              <RankedRow
                key={c.country}
                rank={i + 1}
                title={c.country}
                value={`${Math.round(c.share * 100)}%`}
                subtitle={`${formatCount(c.listeners)} listeners`}
                share={c.share / data.listenerCountries[0].share}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: spacing.xl },
  sections: { gap: spacing.xxl },
  stale: { opacity: 0.5 },
  pressed: { opacity: 0.8 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.display, color: colors.textPrimary },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  uploadText: { ...typography.label, color: colors.onPrimary },

  grid: { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chartTitle: { ...typography.label, color: colors.textSecondary },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { ...typography.caption, color: colors.textMuted },

  roomStats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  roomStat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  roomValue: { ...typography.title, color: colors.textPrimary },
  roomLabel: { ...typography.caption, color: colors.textSecondary },

  message: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  messageText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});