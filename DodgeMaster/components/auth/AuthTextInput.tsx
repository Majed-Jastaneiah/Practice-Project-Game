import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardTypeOptions,
} from 'react-native';
import { Colors } from '@/constants/Colors';

interface AuthTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  isPassword?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  editable?: boolean;
}

export function AuthTextInput({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType = 'default',
  isPassword = false,
  autoCapitalize = 'none',
  autoComplete,
  editable = true,
}: AuthTextInputProps) {
  const [secure, setSecure] = useState(isPassword);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputError : styles.inputDefault]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete as any}
          editable={editable}
          style={styles.input}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setSecure((p) => !p)} hitSlop={10}>
            <Text style={styles.toggle}>{secure ? 'SHOW' : 'HIDE'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.backgroundAlt,
  },
  inputDefault: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  toggle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.danger,
  },
});
