import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/ui/Artwork';
import { colors, spacing, typography } from '@/constants/theme';
import type { Album } from '@/types/models';

export function AlbumRow({ album, onPress }: { album: Album; onPress?: (a: Album) => void }) {
  const year = new Date(album.releaseDate).getFullYear();
  return (
    <Pressable
      onPress={() => onPress?.(album)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Artwork uri={album.coverUrl} seed={album.id} size={52} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{album.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {album.artistName} · {year} · {album.songIds.length} {album.songIds.length === 1 ? 'track' : 'tracks'}
        </Text>
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