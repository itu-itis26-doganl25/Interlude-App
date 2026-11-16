import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, typography } from '@/constants/theme';
import type { User } from '@/types/models';

export function UserRow({ user }: { user: User }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar uri={user.avatarUrl} name={user.displayName} seed={user.id} size={52} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{user.displayName}</Text>
        <Text style={styles.role}>{user.role === 'musician' ? 'Artist' : 'Listener'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.surface },
  info: { flex: 1, gap: 2 },
  name: { ...typography.subtitle, color: colors.textPrimary },
  role: { ...typography.caption, color: colors.textSecondary },
});