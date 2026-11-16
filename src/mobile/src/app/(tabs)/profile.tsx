import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, typography } from '@/constants/theme';
import { ProfileView } from '@/components/profile/ProfileView';

export default function ProfileScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfileView userId={user.id} withTopInset />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  name: { ...typography.title, color: colors.textPrimary },
  role: { ...typography.body, color: colors.textSecondary },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});