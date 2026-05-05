import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CoinDisplay } from './CoinDisplay';
import { Colors } from '@/constants/Colors';

interface GameHUDProps {
  score: number;
  coins: number;
  onPause: () => void;
}

export function GameHUD({ score, coins, onPause }: GameHUDProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Coin balance — top left */}
      <CoinDisplay amount={coins} size="small" />

      {/* Score — top centre */}
      <Text style={styles.score}>{score}</Text>

      {/* Pause — top right */}
      <TouchableOpacity onPress={onPause} hitSlop={12} style={styles.pauseBtn}>
        <Text style={styles.pauseIcon}>⏸</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52, // clear the status bar area
    zIndex: 10,
  },
  score: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  pauseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
});
