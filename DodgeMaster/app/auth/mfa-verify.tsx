/**
 * MFA Verification Screen — shown during sign-in when Firebase detects
 * that the user has TOTP MFA enrolled.
 *
 * Reads the pending MFA resolver from authService (module-level ref)
 * and resolves it using the OTP the user enters.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { resolveMFASignIn, signOut } from '@/services/authService';
import { validateOTP } from '@/utils/validators';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { Button } from '@/components/Button';

export default function MFAVerifyScreen() {
  const [otp, setOtp]           = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleVerify = useCallback(async () => {
    const err = validateOTP(otp);
    setOtpError(err);
    if (err) return;

    setLoading(true);
    const result = await resolveMFASignIn(otp);
    setLoading(false);

    if (result.status === 'ok') {
      router.replace('/');
    } else {
      setOtpError(result.message);
    }
  }, [otp]);

  const handleCancel = useCallback(async () => {
    await signOut();
    router.replace('/auth/signin');
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <Text style={styles.icon}>🔐</Text>

        <Text style={styles.title}>Two-Factor Verification</Text>

        <Text style={styles.body}>
          Enter the 6-digit code from your authenticator app to complete sign-in.
        </Text>

        <View style={styles.form}>
          <AuthTextInput
            label="Authentication Code"
            value={otp}
            onChangeText={setOtp}
            error={otpError}
            placeholder="000000"
            keyboardType="number-pad"
          />

          <Button
            label="VERIFY"
            onPress={handleVerify}
            variant="primary"
            loading={loading}
            style={styles.btn}
          />

          <Button
            label="Cancel / Sign Out"
            onPress={handleCancel}
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
  icon: { fontSize: 56, marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: 1,
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  form: { width: '100%', gap: 12 },
  btn: { width: '100%' },
});
