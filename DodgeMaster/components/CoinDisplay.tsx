import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface CoinDisplayProps {
  amount: number;
  size?: 'small' | 'medium' | 'large';
}

export function CoinDisplay({ amount, size = 'medium' }: CoinDisplayProps) {
  const s = sizeMap[size];
  return (
    <View style={styles.row}>
      {/* Coin icon — a gold circle with a '$' */}
      <View style={[styles.coin, { width: s.icon, height: s.icon, borderRadius: s.icon / 2 }]}>
        <Text style={[styles.coinSymbol, { fontSize: s.icon * 0.55 }]}>✦</Text>
      </View>
      <Text style={[styles.amount, { fontSize: s.font }]}>{amount}</Text>
    </View>
  );
}

const sizeMap = {
  small:  { icon: 18, font: 13 },
  medium: { icon: 24, font: 17 },
  large:  { icon: 32, font: 22 },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coin: {
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  coinSymbol: {
    color: Colors.buttonText,
    fontWeight: '900',
    lineHeight: undefined,
  },
  amount: {
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
