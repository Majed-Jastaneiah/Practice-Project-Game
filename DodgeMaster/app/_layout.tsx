import React, { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';

/**
 * Auth guard — runs inside AuthProvider so it has access to auth state.
 * Redirects unauthenticated users to /auth/signin, and users whose email
 * is not yet verified to /auth/verify-email.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isVerified } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user) {
      // No user → must sign in
      if (!inAuthGroup) router.replace('/auth/signin');
    } else if (!isVerified && user.providerData[0]?.providerId === 'password') {
      // Email/password user who hasn't verified their email yet
      if (!inAuthGroup) router.replace('/auth/verify-email');
    } else if (inAuthGroup) {
      // Already authenticated → go to home
      router.replace('/');
    }
  }, [user, loading, isVerified, segments]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <AuthProvider>
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="game" />
            <Stack.Screen name="gameover" />
            <Stack.Screen name="shop" />
            <Stack.Screen name="auth" />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
