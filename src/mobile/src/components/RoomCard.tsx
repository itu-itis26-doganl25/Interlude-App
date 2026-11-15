import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { LiveRoom } from '@/services';

export function RoomCard({ room, onPress }: { room: LiveRoom; onPress?: (r: LiveRoom) => void }) {
  return (
    <Pressable
      onPress={() => onPress?.(room)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        {room.isLive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>● LIVE</Text>
          </View>
        )}
        <Text style={styles.listeners}>{room.listenerCount} listening</Text>
      </View>

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>{room.name}</Text>
        <Text style={styles.host} numberOfLines={1}>Hosted by {room.hostName}</Text>
      </View>

      {room.currentSong && (
        <Text style={styles.nowPlaying} numberOfLines={1}>
          ♪ {room.currentSong.title} — {room.currentSong.artistName}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 250,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: { backgroundColor: colors.dangerSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  liveText: { ...typography.caption, color: colors.danger, fontWeight: '700' },
  listeners: { ...typography.caption, color: colors.textSecondary },
  middle: { gap: 2 },
  name: { ...typography.subtitle, color: colors.textPrimary },
  host: { ...typography.caption, color: colors.textSecondary },
  nowPlaying: { ...typography.caption, color: colors.accent },
});