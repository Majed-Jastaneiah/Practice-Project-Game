import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.buttonText : Colors.gold}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  primary: {
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  danger: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  primaryLabel: {
    color: Colors.buttonText,
  },
  secondaryLabel: {
    color: Colors.gold,
  },
  dangerLabel: {
    color: Colors.white,
  },
  ghostLabel: {
    color: Colors.textSecondary,
  },
});
