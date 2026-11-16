import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  value: string;
  label: string;
  onPress?: () => void;
}

export function StatItem({ value, label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: 2, minWidth: 64, paddingVertical: spacing.xs },
  pressed: { opacity: 0.6 },
  value: { ...typography.title, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary },
});