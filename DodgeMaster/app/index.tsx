import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useCoins } from '@/hooks/useCoins';
import { useBestScore } from '@/hooks/useBestScore';
import { useReferral } from '@/hooks/useReferral';
import { useAuth } from '@/contexts/AuthContext';
import { getRankForScore } from '@/constants/Ranks';
import { CoinDisplay } from '@/components/CoinDisplay';
import { Button } from '@/components/Button';
import { ShareModal } from '@/components/share/ShareModal';

export default function HomeScreen() {
  const { coins, loading }  = useCoins();
  const { bestScore }       = useBestScore();
  const { user }            = useAuth();
  const { referralCode, recordShare } = useReferral();

  const [shareVisible, setShareVisible] = useState(false);

  const rank       = getRankForScore(bestScore);
  const playerName = user?.displayName ?? user?.email?.split('@')[0];

  const openInvite = useCallback(() => setShareVisible(true), []);
  const closeShare = useCallback(() => setShareVisible(false), []);

  const handleShareClose = useCallback(() => {
    closeShare();
    recordShare();
  }, [closeShare, recordShare]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Top bar: profile info + coins */}
        <View style={styles.topBar}>
          <Text style={styles.rankBadge}>{rank.emoji}  {rank.label}</Text>
          <CoinDisplay amount={loading ? 0 : coins} size="medium" />
        </View>

        {/* Title block */}
        <View style={styles.hero}>
          <Text style={styles.subtitle}>SURVIVAL</Text>
          <Text style={styles.title}>DODGE{'\n'}MASTER</Text>
          <View style={styles.divider} />
          {bestScore > 0 && (
            <Text style={styles.bestScore}>BEST  {bestScore}s</Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="PLAY"
            onPress={() => router.push('/game')}
            variant="primary"
            style={styles.playBtn}
          />
          <View style={styles.secondaryRow}>
            <Button label="SHOP" onPress={() => router.push('/shop')} variant="secondary" style={styles.halfBtn} />
            <Button label="📤 INVITE" onPress={openInvite} variant="secondary" style={styles.halfBtn} />
          </View>
        </View>

        <Text style={styles.hint}>
          Hold and drag to move your dot.{'\n'}Don't get hit.
        </Text>

      </View>

      {/* Invite / share modal */}
      <ShareModal
        visible={shareVisible}
        onClose={handleShareClose}
        variant="invite"
        score={bestScore}
        rank={rank}
        playerName={playerName}
        referralCode={referralCode ?? undefined}
        headline={`BEAT MY\n${bestScore}s!`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  rankBadge: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 2,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 6,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    color: Colors.gold,
    textAlign: 'center',
    lineHeight: 68,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    letterSpacing: 4,
  },
  divider: {
    width: 48,
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
    marginVertical: 20,
    opacity: 0.5,
  },
  bestScore: {
    fontSize: 14,
    letterSpacing: 4,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actions: { gap: 14, alignItems: 'center' },
  playBtn: { paddingVertical: 18, minWidth: 220 },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  halfBtn: { flex: 1, maxWidth: 160, minWidth: 0 },
  hint: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 24,
    opacity: 0.7,
  },
});
