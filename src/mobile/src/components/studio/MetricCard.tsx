import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { Metric } from '@/services';
import { formatCount } from '@/utils/format';

interface Props {
  label: string;
  metric: Metric;
  format?: (n: number) => string;
}

export function MetricCard({ label, metric, format = formatCount }: Props) {
  const delta =
    metric.previous > 0 ? ((metric.value - metric.previous) / metric.previous) * 100 : null;
  const up = (delta ?? 0) >= 0;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{format(metric.value)}</Text>
      {delta !== null && (
        <Text style={[styles.delta, { color: up ? colors.success : colors.danger }]}>
          {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.display, color: colors.textPrimary },
  delta: { ...typography.label },
});