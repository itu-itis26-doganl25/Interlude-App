import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { StudioSummary } from '@/services';
import { formatCount } from '@/utils/format';

interface Props {
  summary: StudioSummary;
  onPress: () => void;
}

export function StudioSummaryCard({ summary, onPress }: Props) {
  const max = Math.max(...summary.last7Days, 1);
  const weekTotal = summary.last7Days.reduce((a, b) => a + b, 0);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Studio</Text>
        <Text style={styles.open}>Open ›</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.numbers}>
          <Text style={styles.total}>{formatCount(summary.totalPlays)}</Text>
          <Text style={styles.caption}>total plays</Text>
          <Text style={styles.week}>+{formatCount(weekTotal)} this week</Text>
        </View>

        <View style={styles.bars}>
          {summary.last7Days.map((v, i) => (
            <View key={i} style={[styles.bar, { height: Math.max(4, (v / max) * 48) }]} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.label, color: colors.textSecondary },
  open: { ...typography.label, color: colors.accent },
  body: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  numbers: { gap: 2 },
  total: { ...typography.display, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  week: { ...typography.caption, color: colors.success },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 48 },
  bar: { width: 8, borderRadius: 3, backgroundColor: colors.primary },
});