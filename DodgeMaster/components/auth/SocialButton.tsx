import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';

type SocialProvider = 'google' | 'apple' | 'facebook';

const PROVIDERS: Record<SocialProvider, { label: string; icon: string; color: string; textColor: string }> = {
  google: {
    label: 'Continue with Google',
    icon: 'G',
    color: '#FFFFFF',
    textColor: '#1F1F1F',
  },
  apple: {
    label: 'Continue with Apple',
    icon: '',
    color: '#FFFFFF',
    textColor: '#000000',
  },
  facebook: {
    label: 'Continue with Facebook',
    icon: 'f',
    color: '#1877F2',
    textColor: '#FFFFFF',
  },
};

interface SocialButtonProps {
  provider: SocialProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function SocialButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
}: SocialButtonProps) {
  const config = PROVIDERS[provider];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        { backgroundColor: config.color },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={config.textColor} size="small" />
      ) : (
        <View style={styles.inner}>
          <Text style={[styles.icon, { color: config.textColor }]}>
            {config.icon}
          </Text>
          <Text style={[styles.label, { color: config.textColor }]}>
            {config.label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
