import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/ui/Artwork';
import { colors, spacing, typography } from '@/constants/theme';
import type { Song } from '@/types/models';
import { formatCount, formatDuration } from '@/utils/format';

export function SongRow({ song, onPress }: { song: Song; onPress?: (s: Song) => void }) {
  return (
    <Pressable
      onPress={() => onPress?.(song)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Artwork uri={song.coverUrl} seed={song.id} size={52} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {song.artistName} · {formatCount(song.playCount)} plays
        </Text>
      </View>
      <Text style={styles.duration}>{formatDuration(song.durationMs)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.surface },
  info: { flex: 1, gap: 2 },
  title: { ...typography.subtitle, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary },
  duration: { ...typography.caption, color: colors.textMuted },
});