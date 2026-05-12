import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

const MAX_LIVES = 5;

interface GameHUDProps {
  score: number;
  lives: number;
  onPause: () => void;
}

export function GameHUD({ score, lives, onPause }: GameHUDProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* Lives — top left: filled red dots for remaining, dim rings for lost */}
      <View style={styles.livesRow}>
        {Array.from({ length: MAX_LIVES }, (_, i) => (
          <View
            key={i}
            style={[styles.lifeDot, i < lives ? styles.dotAlive : styles.dotDead]}
          />
        ))}
      </View>

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
    paddingTop: 52,
    zIndex: 10,
  },

  // ── Lives row ──────────────────────────────────────────────────────────────
  livesRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  lifeDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },
  dotAlive: {
    backgroundColor: '#FF3A3A',
    shadowColor:     '#FF0000',
    shadowOffset:    { width: 0, height: 0 },
    shadowRadius:    5,
    shadowOpacity:   1,
    elevation:       6,
  },
  dotDead: {
    backgroundColor: 'rgba(180, 40, 40, 0.15)',
    borderWidth:     1,
    borderColor:     'rgba(255, 58, 58, 0.28)',
  },

  // ── Score ──────────────────────────────────────────────────────────────────
  score: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor:  Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // ── Pause button ───────────────────────────────────────────────────────────
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
