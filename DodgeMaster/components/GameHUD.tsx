import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

const MAX_LIVES = 5;

interface GameHUDProps {
  score: number;
  lives: number;
  onPause: () => void;
  survivalTime: number;
  mysteryBoxCount: number;
  onMysteryBoxTap: () => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export function GameHUD({ score, lives, onPause, survivalTime, mysteryBoxCount, onMysteryBoxTap }: GameHUDProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* Top row: lives | score + timer | pause */}
      <View style={styles.topRow}>

        {/* Lives — heart emoji, +N for extra lives beyond 5 */}
        <View style={styles.livesRow}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Text key={i} style={i < Math.min(lives, MAX_LIVES) ? styles.heartAlive : styles.heartDead}>
              {i < Math.min(lives, MAX_LIVES) ? '❤️' : '🤍'}
            </Text>
          ))}
          {lives > MAX_LIVES && (
            <Text style={styles.extraLivesText}>+{lives - MAX_LIVES}</Text>
          )}
        </View>

        {/* Score + survival timer */}
        <View style={styles.centerSection}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.timer}>{formatTime(survivalTime)}</Text>
        </View>

        {/* Pause — top right */}
        <TouchableOpacity onPress={onPause} hitSlop={12} style={styles.pauseBtn}>
          <Text style={styles.pauseIcon}>⏸</Text>
        </TouchableOpacity>

      </View>

      {/* Mystery box inventory — tap to open choice panel */}
      {mysteryBoxCount > 0 && (
        <View style={styles.inventoryRow}>
          <TouchableOpacity onPress={onMysteryBoxTap} style={styles.mysteryBoxBtn}>
            <Text style={styles.inventoryItem}>🎁</Text>
            {mysteryBoxCount > 1 && (
              <Text style={styles.mysteryBoxBadge}>×{mysteryBoxCount}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 52,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  centerSection: {
    alignItems: 'center',
  },

  // ── Lives row ──────────────────────────────────────────────────────────────
  livesRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  heartAlive: {
    fontSize: 15,
  },
  heartDead: {
    fontSize: 15,
    opacity: 0.35,
  },
  extraLivesText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF6B6B',
    marginLeft: 2,
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

  // ── Survival timer ─────────────────────────────────────────────────────────
  timer: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
  },

  // ── Mystery box inventory ──────────────────────────────────────────────────
  inventoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  mysteryBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  inventoryItem: {
    fontSize: 22,
  },
  mysteryBoxBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFD700',
  },
});
