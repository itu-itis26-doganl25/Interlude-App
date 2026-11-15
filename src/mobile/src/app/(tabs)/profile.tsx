import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, typography } from '@/constants/theme';

export default function ProfilePlaceholder() {
  const { user, logout } = useAuth();
  return (
    <View style={styles.container}>
      <Avatar uri={user?.avatarUrl ?? null} name={user?.displayName ?? ''} seed={user?.id ?? ''} size={96} />
      <Text style={styles.name}>{user?.displayName}</Text>
      <Text style={styles.role}>{user?.role}</Text>
      <Button title="Log out" variant="secondary" onPress={logout} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  name: { ...typography.title, color: colors.textPrimary },
  role: { ...typography.body, color: colors.textSecondary },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});