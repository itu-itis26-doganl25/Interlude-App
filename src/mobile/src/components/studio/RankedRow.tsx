import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/ui/Artwork';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface Props {
  rank: number;
  title: string;
  subtitle?: string;
  value: string;
  share: number; // 0-1, listedeki en yüksek değere oranı
  artworkSeed?: string; // verilirse kapak gösterilir
}

export function RankedRow({ rank, title, subtitle, value, share, artworkSeed }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.rank}>{rank}</Text>
      {artworkSeed && <Artwork uri={null} seed={artworkSeed} size={44} />}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(2, share * 100)}%` }]} />
        </View>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  rank: { ...typography.label, color: colors.textMuted, width: 18, textAlign: 'center' },
  info: { flex: 1, gap: 3 },
  title: { ...typography.subtitle, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  value: { ...typography.label, color: colors.textSecondary },
});