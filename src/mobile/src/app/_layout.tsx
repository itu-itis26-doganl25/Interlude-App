import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();
  const router = useRouter();
  const prevStatus = useRef(status);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  // Oturum kapandığında login ekranına git
  useEffect(() => {
    if (prevStatus.current === 'authenticated' && status === 'unauthenticated') {
      router.replace('/login');
    }
    prevStatus.current = status;
  }, [status, router]);

  if (status === 'loading') return null;
  const isAuthed = status === 'authenticated';

  const headerOptions = {
    headerShown: true,
    headerTitle: '',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.textPrimary,
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={isAuthed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="user/[id]" options={headerOptions} />
          <Stack.Screen name="connections" options={headerOptions} />
          <Stack.Screen name="user-search" options={{ ...headerOptions, headerTitle: 'Find people' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthed}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}