import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, typography } from '@/constants/theme';

export default function BrowsePlaceholder() {
  const { user, logout } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <Text style={{ ...typography.title, color: colors.textPrimary }}>
        Hello, {user?.displayName} ({user?.role})
      </Text>
      <Button title="Log out" variant="secondary" onPress={logout} />
    </View>
  );
}