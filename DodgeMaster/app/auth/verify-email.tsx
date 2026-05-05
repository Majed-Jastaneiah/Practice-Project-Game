import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { reload } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { resendVerificationEmail, signOut } from '@/services/authService';
import { Colors } from '@/constants/Colors';
import { Button } from '@/components/Button';

export default function VerifyEmailScreen() {
  const [resending, setResending]     = useState(false);
  const [resent, setResent]           = useState(false);
  const [checking, setChecking]       = useState(false);
  const [errorMessage, setError]      = useState<string | null>(null);

  const userEmail = auth.currentUser?.email ?? 'your email';

  // Poll for email verification every 5 seconds so the user
  // doesn't have to manually tap "I verified my email".
  useEffect(() => {
    const interval = setInterval(async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        await reload(user);
        if (user.emailVerified) {
          clearInterval(interval);
          router.replace('/');
        }
      } catch {
        // Network blip — keep polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleResend = useCallback(async () => {
    setResending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setResent(true);
    } catch {
      setError('Could not resend. Please try again in a moment.');
    } finally {
      setResending(false);
    }
  }, []);

  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (user) {
        await reload(user);
        if (user.emailVerified) {
          router.replace('/');
          return;
        }
      }
      setError('Email not yet verified. Check your inbox and spam folder.');
    } catch {
      setError('Could not check verification status. Try again.');
    } finally {
      setChecking(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/auth/signin');
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <Text style={styles.icon}>✉️</Text>

        <Text style={styles.title}>Verify Your Email</Text>

        <Text style={styles.body}>
          We sent a verification link to{'\n'}
          <Text style={styles.email}>{userEmail}</Text>
          {'\n\n'}
          Open the link in that email to activate your account.
          This screen will automatically advance once verified.
        </Text>

        {resent && (
          <Text style={styles.sentNote}>✓ Verification email resent.</Text>
        )}

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="I VERIFIED MY EMAIL"
            onPress={handleCheckNow}
            variant="primary"
            loading={checking}
          />
          <Button
            label={resent ? 'Resent ✓' : 'Resend Email'}
            onPress={handleResend}
            variant="secondary"
            loading={resending}
            disabled={resent}
          />
          <Button
            label="Sign Out"
            onPress={handleSignOut}
            variant="ghost"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  icon: { fontSize: 64, marginBottom: 8 },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  email: {
    color: Colors.gold,
    fontWeight: '700',
  },
  sentNote: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});
