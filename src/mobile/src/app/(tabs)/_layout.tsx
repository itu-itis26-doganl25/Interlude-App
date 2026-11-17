import type React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from 'expo-router/build/react-navigation/bottom-tabs/index.js';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { colors } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return (
      <Ionicons
        name={focused ? active : inactive}
        size={size}
        color={focused ? colors.primary : colors.textMuted}
      />
    );
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
      tabBar={(props: TabBarProps) => (
        <View>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen
        name="library"
        options={{ title: 'Library', tabBarIcon: tabIcon('library', 'library-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}