import React, { useState, useCallback } from 'react';
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
import { registerWithEmail } from '@/services/authService';
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from '@/utils/validators';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { Button } from '@/components/Button';

export default function SignUpScreen() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwError, setPwError]       = useState<string | null>(null);
  const [cfError, setCfError]       = useState<string | null>(null);
  const [generalError, setGeneral]  = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const handleRegister = useCallback(async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirm);

    setEmailError(eErr);
    setPwError(pErr);
    setCfError(cErr);
    if (eErr || pErr || cErr) return;

    setLoading(true);
    setGeneral(null);
    const result = await registerWithEmail(email.trim(), password);
    setLoading(false);

    if (result.status === 'needs-verification') {
      router.replace('/auth/verify-email');
    } else if (result.status === 'error') {
      setGeneral(result.message);
    }
  }, [email, password, confirm]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          You'll receive an activation link on your email.{'\n'}
          Click it to unlock the game.
        </Text>

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
            error={pwError}
            placeholder="At least 8 chars, 1 uppercase, 1 number"
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
  backText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
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
    marginBottom: 32,
  },
  form: { width: '100%' },
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
