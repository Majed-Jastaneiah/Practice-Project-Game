import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { Colors } from '@/constants/Colors';
import {
  signInWithEmail,
  signInWithGoogleCredential,
  signInWithAppleCredential,
  signInWithFacebookCredential,
} from '@/services/authService';
import { validateEmail, validatePassword } from '@/utils/validators';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { SocialButton } from '@/components/auth/SocialButton';
import { Button } from '@/components/Button';

// Required for expo-auth-session redirect handling
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const [googleRequest, googleResponse, promptGoogleAsync] =
    Google.useAuthRequest({
      webClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
      iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (idToken) handleOAuthResult(signInWithGoogleCredential(idToken));
    }
  }, [googleResponse]);

  // ── Facebook OAuth ────────────────────────────────────────────────────────
  const [fbRequest, fbResponse, promptFacebookAsync] =
    Facebook.useAuthRequest({
      clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
    });

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const accessToken = fbResponse.params?.access_token;
      if (accessToken) handleOAuthResult(signInWithFacebookCredential(accessToken));
    }
  }, [fbResponse]);

  // ── Shared OAuth result handler ───────────────────────────────────────────
  async function handleOAuthResult(promise: ReturnType<typeof signInWithGoogleCredential>) {
    setLoading(true);
    setGeneralError(null);
    const result = await promise;
    setLoading(false);

    if (result.status === 'ok') {
      router.replace('/');
    } else if (result.status === 'needs-mfa') {
      router.push('/auth/mfa-verify');
    } else if (result.status === 'error') {
      setGeneralError(result.message);
    }
  }

  // ── Apple Sign In (iOS only) ──────────────────────────────────────────────
  const handleAppleSignIn = useCallback(async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      const { rawNonce, hashedNonce } = await generateNonce();

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken } = appleCredential;
      if (!identityToken) throw new Error('Apple did not return an identity token.');

      await handleOAuthResult(signInWithAppleCredential(identityToken, rawNonce));
    } catch (error: any) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        setGeneralError('Apple sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Email sign-in ─────────────────────────────────────────────────────────
  const handleEmailSignIn = useCallback(async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    setGeneralError(null);
    const result = await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (result.status === 'ok') {
      router.replace('/');
    } else if (result.status === 'needs-verification') {
      router.push('/auth/verify-email');
    } else if (result.status === 'needs-mfa') {
      router.push('/auth/mfa-verify');
    } else {
      setGeneralError(result.message);
    }
  }, [email, password]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
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
          <SocialButton
            provider="facebook"
            onPress={() => promptFacebookAsync()}
            loading={loading}
            disabled={!fbRequest}
          />
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
            style={styles.signInBtn}
          />
        </View>

        {/* Register link */}
        <Button
          label="Create account"
          onPress={() => router.push('/auth/signup')}
          variant="ghost"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function generateNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce =
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, hashedNonce };
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
  },
  social: {
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  form: {
    width: '100%',
    marginBottom: 12,
  },
  generalError: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  signInBtn: {
    width: '100%',
    marginTop: 8,
  },
});
