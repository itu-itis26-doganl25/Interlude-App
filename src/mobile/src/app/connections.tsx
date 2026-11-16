import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { UserRow } from '@/components/UserRow';
import { colors, spacing, typography } from '@/constants/theme';
import { useConnections } from '@/hooks/use-connections';
import type { ConnectionKind } from '@/services';

export default function ConnectionsScreen() {
  const { userId, kind } = useLocalSearchParams<{ userId: string; kind: ConnectionKind }>();
  const { users, loading, error } = useConnections(userId, kind);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: kind === 'followers' ? 'Followers' : 'Following' }} />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} />}
          ListEmptyComponent={
            <Text style={styles.message}>{error ?? 'Nobody here yet.'}</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl },
});