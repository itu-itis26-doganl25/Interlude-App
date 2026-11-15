import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/ui/Artwork';
import { colors, spacing, typography } from '@/constants/theme';
import type { User } from '@/types/models';

export function ArtistRow({ artist, onPress }: { artist: User; onPress?: (u: User) => void }) {
  return (
    <Pressable
      onPress={() => onPress?.(artist)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Artwork uri={artist.avatarUrl} seed={artist.id} size={52} round />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{artist.displayName}</Text>
        <Text style={styles.sub}>Artist</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.surface },
  info: { flex: 1, gap: 2 },
  title: { ...typography.subtitle, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary },
});