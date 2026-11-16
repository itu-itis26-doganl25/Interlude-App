import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { UserRow } from '@/components/UserRow';
import { SearchBar } from '@/components/ui/SearchBar';
import { colors, spacing, typography } from '@/constants/theme';
import { useUserSearch } from '@/hooks/use-user-search';

export default function UserSearchScreen() {
  const [query, setQuery] = useState('');
  const { users, loading, error } = useUserSearch(query);
  const hasQuery = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search people" />
      </View>

      {hasQuery && !users && !error ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={users ?? []}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <UserRow user={item} />}
          contentContainerStyle={loading ? styles.stale : undefined}
          ListEmptyComponent={
            <Text style={styles.message}>
              {error ?? (hasQuery ? 'No people found.' : 'Search for listeners and artists.')}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  loader: { marginTop: spacing.xxxl },
  stale: { opacity: 0.6 },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl },
});