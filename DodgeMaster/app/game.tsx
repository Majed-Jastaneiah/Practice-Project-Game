import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { GAME_CONFIG } from '@/constants/GameConfig';
import { COIN_VALUES } from '@/constants/Coins';
import { Colors } from '@/constants/Colors';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useCoins } from '@/hooks/useCoins';
import { useBestScore } from '@/hooks/useBestScore';
import { PlayerDot } from '@/components/PlayerDot';
import { ObstacleItem } from '@/components/ObstacleItem';
import { GameHUD } from '@/components/GameHUD';
import { Button } from '@/components/Button';
import { CoinDisplay } from '@/components/CoinDisplay';

const R = GAME_CONFIG.PLAYER_RADIUS;

export default function GameScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // ── Player position (lives on UI thread — follows finger directly) ──
  const playerX = useSharedValue(screenWidth / 2);
  const playerY = useSharedValue(screenHeight / 2);

  // ── Coins & score persistence ──
  const { coins, spend, add } = useCoins();
  const { bestScore, submitScore } = useBestScore();

  // ── Milestone tracking (earn coins every N score points) ──
  const lastMilestoneRef = useRef(0);
  const coinsEarnedRef = useRef(0);

  // ── Revive tracking ──
  const [canRevive, setCanRevive] = useState(true); // only one revive per run
  const [reviving, setReviving] = useState(false);

  // ── Invincibility flash (visual only) ──
  const [isInvincible, setIsInvincible] = useState(false);

  // ── Death callback — called once when game over occurs ──
  const handleDeath = useCallback(
    (finalScore: number) => {
      submitScore(finalScore);
    },
    [submitScore],
  );

  // ── Game engine ──
  const { obstacles, score, phase, chaosMode, pauseGame, resumeGame, revivePlayer } =
    useGameEngine({
      playerX,
      playerY,
      screenWidth,
      screenHeight,
      onDeath: handleDeath,
    });

  // Award coins at score milestones
  useEffect(() => {
    const currentMilestone = Math.floor(
      score / GAME_CONFIG.COINS_PER_MILESTONE_SCORE,
    );
    if (currentMilestone > lastMilestoneRef.current) {
      lastMilestoneRef.current = currentMilestone;
      add(COIN_VALUES.MILESTONE_REWARD).then(() => {
        coinsEarnedRef.current += COIN_VALUES.MILESTONE_REWARD;
      });
    }
  }, [score, add]);

  // ── Pan gesture — player follows finger on the UI thread ──
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      playerX.value = Math.min(
        Math.max(e.x, R),
        screenWidth - R,
      );
      playerY.value = Math.min(
        Math.max(e.y, R),
        screenHeight - R,
      );
    })
    .onUpdate((e) => {
      playerX.value = Math.min(
        Math.max(e.x, R),
        screenWidth - R,
      );
      playerY.value = Math.min(
        Math.max(e.y, R),
        screenHeight - R,
      );
    });

  // ── Animated style for player dot ──
  const playerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: playerX.value - R },
      { translateY: playerY.value - R },
    ],
  }));

  // ── Revive handler ──
  const handleRevive = useCallback(async () => {
    if (!canRevive) return;
    setReviving(true);
    const success = await spend(COIN_VALUES.REVIVE_COST);
    if (success) {
      setCanRevive(false);
      setIsInvincible(true);
      // Reset player to center
      playerX.value = screenWidth / 2;
      playerY.value = screenHeight / 2;
      revivePlayer();
      setTimeout(
        () => setIsInvincible(false),
        GAME_CONFIG.REVIVE_INVINCIBILITY_MS,
      );
    }
    setReviving(false);
  }, [
    canRevive,
    spend,
    playerX,
    playerY,
    screenWidth,
    screenHeight,
    revivePlayer,
  ]);

  // ── Quit to results screen ──
  const handleQuit = useCallback(() => {
    router.replace({
      pathname: '/gameover',
      params: {
        score: String(score),
        coinsEarned: String(coinsEarnedRef.current),
      },
    });
  }, [score]);

  const hasEnoughCoinsToRevive = coins >= COIN_VALUES.REVIVE_COST;

  return (
    <View style={[styles.root, chaosMode && styles.rootChaos]}>
      <StatusBar hidden />

      {/* ── Game field ── */}
      <GestureDetector gesture={panGesture}>
        <View style={StyleSheet.absoluteFill}>
          {obstacles.map((obs) => (
            <ObstacleItem key={obs.id} obstacle={obs} />
          ))}
          <PlayerDot animatedStyle={playerStyle} isInvincible={isInvincible} />
          <GameHUD score={score} coins={coins} onPause={pauseGame} />
        </View>
      </GestureDetector>

      {/* ── Pause overlay ── */}
      {phase === 'paused' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>PAUSED</Text>
          <View style={styles.overlayActions}>
            <Button label="RESUME" onPress={resumeGame} variant="primary" />
            <Button label="QUIT" onPress={handleQuit} variant="ghost" />
          </View>
        </View>
      )}

      {/* ── Death overlay ── */}
      {phase === 'dead' && (
        <View style={[styles.overlay, styles.deadOverlay]}>
          <Text style={styles.deadTitle}>YOU DIED</Text>
          <Text style={styles.deadScore}>{score}s</Text>

          {bestScore > 0 && score >= bestScore && (
            <Text style={styles.newBest}>✦ NEW BEST ✦</Text>
          )}

          <View style={styles.overlayActions}>
            {/* Revive — only shown if player has enough coins and hasn't revived yet */}
            {canRevive && (
              <View style={styles.reviveBlock}>
                <Button
                  label={`REVIVE  (${COIN_VALUES.REVIVE_COST} ✦)`}
                  onPress={handleRevive}
                  variant="primary"
                  disabled={!hasEnoughCoinsToRevive}
                  loading={reviving}
                />
                {!hasEnoughCoinsToRevive && (
                  <Text style={styles.notEnoughCoins}>Not enough coins</Text>
                )}
              </View>
            )}

            <Button label="QUIT" onPress={handleQuit} variant="secondary" />
          </View>

          {/* Show coins earned so far */}
          <View style={styles.coinsRow}>
            <Text style={styles.coinsLabel}>EARNED  </Text>
            <CoinDisplay amount={coinsEarnedRef.current} size="small" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootChaos: {
    backgroundColor: '#1A0000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  deadOverlay: {
    backgroundColor: Colors.overlayDanger,
  },
  overlayTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 6,
  },
  deadTitle: {
    fontSize: 52,
    fontWeight: '900',
    color: Colors.danger,
    letterSpacing: 6,
    textShadowColor: Colors.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  deadScore: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
  },
  newBest: {
    fontSize: 14,
    letterSpacing: 4,
    color: Colors.gold,
    fontWeight: '700',
  },
  overlayActions: {
    gap: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  reviveBlock: {
    alignItems: 'center',
    gap: 6,
  },
  notEnoughCoins: {
    fontSize: 12,
    color: Colors.danger,
    opacity: 0.8,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  coinsLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
});
