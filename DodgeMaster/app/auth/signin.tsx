import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { Colors } from '@/constants/Colors';
import {
  signInWithEmail,
  signInWithGoogleCredential,
  signInWithAppleCredential,
  setUsernameForUser,
  checkUsernameAvailable,
} from '@/services/authService';
import { validateEmail, validatePassword } from '@/utils/validators';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { SocialButton } from '@/components/auth/SocialButton';
import { Button } from '@/components/Button';
import type { User } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

// Username rules (mirrored from signup.tsx — kept local so this file is self-contained)
function validateUsername(value: string): string | null {
  if (!value) return 'Username is required.';
  if (value.length < 3) return 'At least 3 characters.';
  if (value.length > 20) return '20 characters max.';
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value))
    return 'Start with a letter. Letters, numbers, and _ only.';
  return null;
}

type ScreenStep = 'signin' | 'pick-username';

export default function SignInScreen() {
  const [step, setStep] = useState<ScreenStep>('signin');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // ── Sign-in form state ─────────────────────────────────────────────────
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  // ── Username picker state (step 2 for social sign-ins) ────────────────
  const [username, setUsername]           = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [savingUsername, setSavingUsername] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 'pick-username') return;
    const formatErr = validateUsername(username);
    if (formatErr || username.length < 3) { setUsernameStatus('idle'); return; }

    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, step]);

  // ── Shared handler: receives AuthResult from any sign-in method ────────
  const handleAuthResult = useCallback(
    async (promise: Promise<{ status: string; user?: User; message?: string }>) => {
      setLoading(true);
      setGeneralError(null);
      const result = await promise;
      setLoading(false);

      if (result.status === 'ok') {
        router.replace('/');
      } else if (result.status === 'needs-username' && result.user) {
        setPendingUser(result.user);
        setStep('pick-username');
      } else if (result.status === 'error') {
        setGeneralError(result.message ?? 'Something went wrong.');
      }
    },
    [],
  );

  // ── Google OAuth ───────────────────────────────────────────────────────
  const [googleRequest, googleResponse, promptGoogleAsync] =
    Google.useAuthRequest({
      webClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
      iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (idToken) handleAuthResult(signInWithGoogleCredential(idToken));
    }
  }, [googleResponse, handleAuthResult]);

  // ── Apple Sign In (iOS only) ───────────────────────────────────────────
  const handleAppleSignIn = useCallback(async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      const rawNonce = Math.random().toString(36).slice(2, 12) +
                       Math.random().toString(36).slice(2, 12);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken } = appleCredential;
      if (!identityToken) throw new Error('Apple did not return an identity token.');

      await handleAuthResult(signInWithAppleCredential(identityToken, rawNonce));
    } catch (error: any) {
      setLoading(false);
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        setGeneralError('Apple sign-in failed. Please try again.');
      }
    }
  }, [handleAuthResult]);

  // ── Email sign-in ──────────────────────────────────────────────────────
  const handleEmailSignIn = useCallback(async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    await handleAuthResult(signInWithEmail(email.trim(), password));
  }, [email, password, handleAuthResult]);

  // ── Username save (step 2) ─────────────────────────────────────────────
  const handleSaveUsername = useCallback(async () => {
    const uErr = validateUsername(username);
    setUsernameError(uErr);
    if (uErr) return;
    if (usernameStatus === 'taken')    { setUsernameError('That username is already taken.'); return; }
    if (usernameStatus === 'checking') { setUsernameError('Still checking — please wait a moment.'); return; }
    if (!pendingUser) return;

    setSavingUsername(true);
    const result = await setUsernameForUser(pendingUser, username.trim());
    setSavingUsername(false);

    if (result.ok) {
      router.replace('/');
    } else {
      setUsernameError(result.message ?? 'Could not save username.');
    }
  }, [username, usernameStatus, pendingUser]);

  const availabilityHint = (() => {
    if (usernameStatus === 'checking')  return { text: 'Checking…',   color: Colors.textSecondary };
    if (usernameStatus === 'available') return { text: '✓ Available', color: '#4CAF50' };
    if (usernameStatus === 'taken')     return { text: '✗ Taken',     color: Colors.danger };
    return null;
  })();

  // ── Render: pick-username step ─────────────────────────────────────────
  if (step === 'pick-username') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Choose a Username</Text>
          <Text style={styles.subtitle}>
            This is your name on the leaderboard.{'\n'}You can't change it later.
          </Text>

          <View style={styles.form}>
            <View>
              <AuthTextInput
                label="Username"
                value={username}
                onChangeText={(t) => { setUsername(t); setUsernameError(null); setUsernameStatus('idle'); }}
                error={usernameError}
                placeholder="e.g. DodgeLegend_99"
                autoCapitalize="none"
                autoComplete="username"
              />
              {availabilityHint && !usernameError && (
                <Text style={[styles.availHint, { color: availabilityHint.color }]}>
                  {availabilityHint.text}
                </Text>
              )}
            </View>

            <Button
              label="ENTER THE GAME"
              onPress={handleSaveUsername}
              variant="primary"
              loading={savingUsername}
              style={styles.fullBtn}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: sign-in step ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>DODGE{'\n'}MASTER</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {/* Social sign-in */}
        <View style={styles.social}>
          <SocialButton
            provider="google"
            onPress={() => promptGoogleAsync()}
            loading={loading}
            disabled={!googleRequest}
          />
          {Platform.OS === 'ios' && (
            <SocialButton
              provider="apple"
              onPress={handleAppleSignIn}
              loading={loading}
            />
          )}
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / Password */}
        <View style={styles.form}>
          <AuthTextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
          />
          <AuthTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            placeholder="••••••••"
            isPassword
            autoComplete="password"
          />

          {generalError ? (
            <Text style={styles.generalError}>{generalError}</Text>
          ) : null}

          <Button
            label="SIGN IN"
            onPress={handleEmailSignIn}
            variant="primary"
            loading={loading}
            style={styles.fullBtn}
          />
        </View>

        <Button
          label="Create account"
          onPress={() => router.push('/auth/signup')}
          variant="ghost"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    padding: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: Colors.gold,
    textAlign: 'center',
    lineHeight: 56,
    letterSpacing: 4,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 36,
    textAlign: 'center',
  },
  social: { width: '100%' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { fontSize: 12, color: Colors.textSecondary },
  form: { width: '100%', marginBottom: 12 },
  availHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 16,
    marginLeft: 2,
  },
  generalError: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  fullBtn: { width: '100%', marginTop: 8 },
});
