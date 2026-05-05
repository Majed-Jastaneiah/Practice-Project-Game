import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useBestScore } from '@/hooks/useBestScore';
import { useReferral } from '@/hooks/useReferral';
import { useAuth } from '@/contexts/AuthContext';
import { getRankForScore } from '@/constants/Ranks';
import { Button } from '@/components/Button';
import { CoinDisplay } from '@/components/CoinDisplay';
import { ShareModal } from '@/components/share/ShareModal';

export default function GameOverScreen() {
  const params = useLocalSearchParams<{ score: string; coinsEarned: string }>();
  const score       = parseInt(params.score ?? '0', 10);
  const coinsEarned = parseInt(params.coinsEarned ?? '0', 10);

  const { user }               = useAuth();
  const { bestScore, submitScore } = useBestScore();
  const { referralCode }       = useReferral();

  const [isNewBest, setIsNewBest]     = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const rank = getRankForScore(score);
  const playerName = user?.displayName ?? user?.email?.split('@')[0];

  useEffect(() => {
    submitScore(score).then((newBest) => {
      setIsNewBest(newBest);
      // Auto-prompt share on new personal best
      if (newBest) setTimeout(() => setShareVisible(true), 600);
    });
  }, [score, submitScore]);

  const openShare = useCallback(() => setShareVisible(true), []);
  const closeShare = useCallback(() => setShareVisible(false), []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <Text style={styles.title}>GAME{'\n'}OVER</Text>

        {/* Score block */}
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>YOUR SCORE</Text>
          <Text style={styles.scoreValue}>{score}s</Text>
          {isNewBest ? (
            <Text style={styles.newBest}>✦ NEW BEST ✦</Text>
          ) : (
            <Text style={styles.oldBest}>BEST  {bestScore}s</Text>
          )}
          <Text style={styles.rankBadge}>{rank.emoji}  {rank.label}</Text>
        </View>

        {/* Coins earned */}
        {coinsEarned > 0 && (
          <View style={styles.coinsBlock}>
            <Text style={styles.coinsLabel}>COINS EARNED</Text>
            <CoinDisplay amount={coinsEarned} size="large" />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="PLAY AGAIN"
            onPress={() => router.replace('/game')}
            variant="primary"
            style={styles.playBtn}
          />
          <Button
            label="📤  SHARE SCORE"
            onPress={openShare}
            variant="secondary"
          />
          <Button
            label="HOME"
            onPress={() => router.navigate('/')}
            variant="ghost"
          />
        </View>

      </View>

      {/* Share modal */}
      <ShareModal
        visible={shareVisible}
        onClose={closeShare}
        variant={isNewBest ? 'score' : 'score'}
        score={score}
        rank={rank}
        playerName={playerName}
        referralCode={referralCode ?? undefined}
        headline={isNewBest ? `NEW BEST!\n${score}s` : `${score}s SURVIVED`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: Colors.danger,
    textAlign: 'center',
    lineHeight: 60,
    letterSpacing: 6,
    textShadowColor: Colors.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  scoreBlock: { alignItems: 'center', gap: 8 },
  scoreLabel: {
    fontSize: 12,
    letterSpacing: 5,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
  },
  newBest: { fontSize: 15, letterSpacing: 4, color: Colors.gold, fontWeight: '700' },
  oldBest: { fontSize: 13, letterSpacing: 3, color: Colors.textSecondary },
  rankBadge: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  coinsBlock: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.backgroundAlt,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  coinsLabel: {
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actions: { gap: 14, alignItems: 'center', width: '100%' },
  playBtn: { paddingVertical: 18, minWidth: 220 },
});
