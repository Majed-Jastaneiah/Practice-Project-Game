import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { doc, getDoc } from 'firebase/firestore';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { db } from '@/services/firebase';

/**
 * Auth + onboarding gate.
 *
 * Routing matrix:
 *   no user                      → /auth/signin
 *   user, in auth group          → /  (already signed in)
 *   user, onboarding not done    → /onboarding  (first launch only)
 *   user, onboarding done,
 *     in onboarding group        → /  (completed, go home)
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  // null = Firestore check not yet started/finished
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Whenever the authenticated user changes, check their onboarding flag.
  useEffect(() => {
    if (!user) {
      setOnboardingDone(null);
      return;
    }
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        setOnboardingDone(snap.data()?.onboardingComplete === true);
      })
      .catch(() => {
        // Fail-open: don't block the player if Firestore is unreachable.
        setOnboardingDone(true);
      });
  }, [user]);

  // Routing effect — runs only when all async state is settled.
  useEffect(() => {
    if (loading) return;

    const inAuthGroup       = segments[0] === 'auth';
    const inOnboardingGroup = segments[0] === 'onboarding';

    if (!user) {
      if (!inAuthGroup) router.replace('/auth/signin');
      return;
    }

    // User is authenticated — wait for the Firestore check before routing.
    if (onboardingDone === null) return;

    if (inAuthGroup) {
      // Just signed in — direct appropriately.
      router.replace(onboardingDone ? '/' : '/onboarding');
    } else if (!onboardingDone && !inOnboardingGroup) {
      // First-time player landing somewhere other than onboarding.
      router.replace('/onboarding');
    } else if (onboardingDone && inOnboardingGroup) {
      // Somehow ended up at onboarding again — redirect home.
      router.replace('/');
    }
  }, [user, loading, onboardingDone, segments]);

  // Show spinner while auth or Firestore check is in flight.
  if (loading || (user !== null && onboardingDone === null)) {
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
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
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
