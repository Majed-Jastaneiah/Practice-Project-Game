/**
 * MFA Enrollment Screen
 *
 * Walks the user through enrolling TOTP-based MFA (Google Authenticator / Authy).
 * Requires Firebase Identity Platform (Blaze plan) with TOTP MFA enabled.
 *
 * Flow:
 *  1. Generate a TOTP secret (server-side via Firebase)
 *  2. Show the secret key for manual entry into an authenticator app
 *  3. User enters the 6-digit OTP to confirm enrollment
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { generateTotpSecret, enrollMFA } from '@/services/authService';
import { validateOTP } from '@/utils/validators';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { Button } from '@/components/Button';

type Step = 'loading' | 'show-key' | 'verify' | 'error';

export default function MFASetupScreen() {
  const [step, setStep]           = useState<Step>('loading');
  const [secret, setSecret]       = useState<any>(null);
  const [secretKey, setSecretKey] = useState('');
  const [otp, setOtp]             = useState('');
  const [otpError, setOtpError]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Generate TOTP secret on mount
  useEffect(() => {
    generateTotpSecret()
      .then(({ secret: s, uri }) => {
        setSecret(s);
        // The key is inside the URI: ...secret=XXXX&...
        const match = uri.match(/secret=([A-Z2-7]+)/i);
        setSecretKey(match?.[1] ?? uri);
        setStep('show-key');
      })
      .catch((err) => {
        setErrorMsg(
          err?.message ??
          'Could not generate MFA secret. Ensure Firebase Identity Platform is enabled.',
        );
        setStep('error');
      });
  }, []);

  const handleEnroll = useCallback(async () => {
    const err = validateOTP(otp);
    setOtpError(err);
    if (err || !secret) return;

    setEnrolling(true);
    const result = await enrollMFA(secret, otp);
    setEnrolling(false);

    if (result.success) {
      Alert.alert(
        '2FA Enabled ✓',
        'Your account is now protected with two-factor authentication.',
        [{ text: 'Continue', onPress: () => router.replace('/') }],
      );
    } else {
      setOtpError(result.message ?? 'Incorrect code. Try again.');
    }
  }, [otp, secret]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enable 2-Factor Auth</Text>

        {step === 'loading' && (
          <Text style={styles.body}>Generating your secret key…</Text>
        )}

        {step === 'error' && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}

        {(step === 'show-key' || step === 'verify') && (
          <>
            {/* Step 1 — enter key into authenticator */}
            <View style={styles.stepBlock}>
              <Text style={styles.stepNum}>Step 1</Text>
              <Text style={styles.stepDesc}>
                Open Google Authenticator or Authy and add a new account manually
                using the key below.
              </Text>
              <View style={styles.keyBox}>
                <Text style={styles.keyLabel}>YOUR SECRET KEY</Text>
                <Text style={styles.keyText} selectable>{secretKey}</Text>
                <Text style={styles.keyNote}>
                  Issuer: Dodge Master  •  Algorithm: TOTP  •  Digits: 6
                </Text>
              </View>
            </View>

            {/* Step 2 — confirm with OTP */}
            <View style={styles.stepBlock}>
              <Text style={styles.stepNum}>Step 2</Text>
              <Text style={styles.stepDesc}>
                Enter the 6-digit code shown in your authenticator app to confirm
                enrollment.
              </Text>
              <AuthTextInput
                label="Verification Code"
                value={otp}
                onChangeText={setOtp}
                error={otpError}
                placeholder="000000"
                keyboardType="number-pad"
              />
              <Button
                label="ENABLE 2FA"
                onPress={handleEnroll}
                variant="primary"
                loading={enrolling}
                style={styles.btn}
              />
            </View>

            <Text style={styles.note}>
              ⚠️  Save your secret key somewhere safe. If you lose access to your
              authenticator app you will need it to recover your account.
            </Text>
          </>
        )}
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
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 28,
    letterSpacing: 1,
  },
  body: { color: Colors.textSecondary, fontSize: 14 },
  errorText: { color: Colors.danger, fontSize: 14, lineHeight: 22 },
  stepBlock: { marginBottom: 28 },
  stepNum: {
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.gold,
    fontWeight: '700',
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 16,
  },
  keyBox: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    gap: 6,
  },
  keyLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  keyText: {
    fontSize: 18,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  keyNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  btn: { width: '100%', marginTop: 4 },
  note: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    opacity: 0.7,
    marginTop: 8,
  },
});
