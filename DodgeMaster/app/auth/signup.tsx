import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import {
  registerWithEmailAndUsername,
  checkUsernameAvailable,
} from '@/services/authService';
import { validateEmail, validatePassword, validatePasswordConfirm } from '@/utils/validators';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { Button } from '@/components/Button';

// Username rules: 3–20 chars, start with a letter, letters/numbers/underscores only
function validateUsername(value: string): string | null {
  if (!value) return 'Username is required.';
  if (value.length < 3) return 'At least 3 characters.';
  if (value.length > 20) return '20 characters max.';
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value))
    return 'Start with a letter. Letters, numbers, and _ only.';
  return null;
}

export default function SignUpScreen() {
  const [username, setUsername]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwError, setPwError]       = useState<string | null>(null);
  const [cfError, setCfError]       = useState<string | null>(null);
  const [generalError, setGeneral]  = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  // Debounced availability check — fires 600 ms after the user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const formatErr = validateUsername(username);
    if (formatErr || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    setUsernameError(null);
    setUsernameStatus('idle');
  }, []);

  const handleRegister = useCallback(async () => {
    const uErr = validateUsername(username);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirm);

    setUsernameError(uErr);
    setEmailError(eErr);
    setPwError(pErr);
    setCfError(cErr);

    if (uErr || eErr || pErr || cErr) return;
    if (usernameStatus === 'taken') {
      setUsernameError('That username is already taken.');
      return;
    }
    if (usernameStatus === 'checking') {
      setUsernameError('Still checking availability — please wait a moment.');
      return;
    }

    setLoading(true);
    setGeneral(null);
    const result = await registerWithEmailAndUsername(
      username.trim(),
      email.trim(),
      password,
    );
    setLoading(false);

    if (result.status === 'ok') {
      router.replace('/');
    } else {
      setGeneral(result.message);
    }
  }, [username, email, password, confirm, usernameStatus]);

  const availabilityHint = (() => {
    if (usernameStatus === 'checking')   return { text: 'Checking…',  color: Colors.textSecondary };
    if (usernameStatus === 'available')  return { text: '✓ Available', color: '#4CAF50' };
    if (usernameStatus === 'taken')      return { text: '✗ Taken',    color: Colors.danger };
    return null;
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Pick a unique username — it's your name on the leaderboard.
        </Text>

        <View style={styles.form}>
          {/* Username with live availability indicator */}
          <View>
            <AuthTextInput
              label="Username"
              value={username}
              onChangeText={handleUsernameChange}
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
            error={pwError}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            isPassword
            autoComplete="new-password"
          />
          <AuthTextInput
            label="Confirm Password"
            value={confirm}
            onChangeText={setConfirm}
            error={cfError}
            placeholder="••••••••"
            isPassword
            autoComplete="new-password"
          />

          {generalError ? (
            <Text style={styles.generalError}>{generalError}</Text>
          ) : null}

          <Button
            label="CREATE ACCOUNT"
            onPress={handleRegister}
            variant="primary"
            loading={loading}
            style={styles.btn}
          />
        </View>

        <Text style={styles.terms}>
          By registering you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 28, paddingTop: 24 },
  back: { marginBottom: 24 },
  backText: { color: Colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 10,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },
  form: { width: '100%', gap: 0 },
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
  btn: { width: '100%', marginTop: 8 },
  terms: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 24,
    lineHeight: 16,
    opacity: 0.7,
  },
});
