import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
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
import { getDailyChallenges } from '@/services/challengeService';
import {
  getWeekEndTime,
  formatCountdown,
  getCurrentWeekKey,
  getWeeklyTopScores,
  type WeeklyScore,
} from '@/services/weeklyChampionService';

export default function HomeScreen() {
  const { coins, loading }  = useCoins();
  const { bestScore }       = useBestScore();
  const { user }            = useAuth();
  const { referralCode, recordShare } = useReferral();

  const [shareVisible, setShareVisible] = useState(false);
  const [challengeDone, setChallengeDone] = useState(0); // 0-3 completed today
  const [weeklyCountdown, setWeeklyCountdown] = useState('');
  const [weeklyTop3, setWeeklyTop3] = useState<WeeklyScore[]>([]);

  const rank       = getRankForScore(bestScore);
  const playerName = user?.displayName ?? user?.email?.split('@')[0];

  const openInvite = useCallback(() => setShareVisible(true), []);
  const closeShare = useCallback(() => setShareVisible(false), []);

  const handleShareClose = useCallback(() => {
    closeShare();
    recordShare();
  }, [closeShare, recordShare]);

  // Load today's challenge completion count for the banner
  useEffect(() => {
    if (!user) return;
    getDailyChallenges(user.uid)
      .then((d) => setChallengeDone(d.challenges.filter((c) => c.completed).length))
      .catch(() => {});
  }, [user]);

  // Weekly countdown timer
  useEffect(() => {
    const tick = () =>
      setWeeklyCountdown(formatCountdown(getWeekEndTime().getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load top 3 for the weekly widget
  useEffect(() => {
    getWeeklyTopScores(getCurrentWeekKey(), 3)
      .then(setWeeklyTop3)
      .catch(() => {});
  }, []);

  const allChallengesDone = challengeDone >= 3;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Top bar: profile info + coins */}
        <View style={styles.topBar}>
          <Text style={styles.rankBadge}>{rank.emoji}  {rank.label}</Text>
          <CoinDisplay amount={loading ? 0 : coins} size="medium" />
        </View>

        {/* Daily challenge banner */}
        <TouchableOpacity
          style={[styles.challengeBanner, allChallengesDone && styles.challengeBannerDone]}
          onPress={() => router.push('/challenges')}
          activeOpacity={0.8}
        >
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerIcon}>{allChallengesDone ? '✅' : '⚡'}</Text>
            <View>
              <Text style={styles.bannerTitle}>DAILY CHALLENGES</Text>
              <Text style={styles.bannerSub}>
                {allChallengesDone
                  ? 'All done! Come back tomorrow.'
                  : `${challengeDone} / 3 completed today`}
              </Text>
            </View>
          </View>
          <View style={styles.dotRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.dot, i < challengeDone && styles.dotFilled]}
              />
            ))}
          </View>
        </TouchableOpacity>

        {/* Weekly championship widget */}
        <TouchableOpacity
          style={styles.weeklyWidget}
          onPress={() => router.push('/weekly')}
          activeOpacity={0.8}
        >
          <View style={styles.weeklyLeft}>
            <Text style={styles.weeklyIcon}>🏆</Text>
            <View>
              <Text style={styles.weeklyTitle}>WEEKLY CHAMPIONSHIP</Text>
              <Text style={styles.weeklyCountdown}>{weeklyCountdown}</Text>
            </View>
          </View>
          {weeklyTop3.length > 0 && (
            <View style={styles.weeklyTop3}>
              {weeklyTop3.map((e, i) => (
                <Text key={e.uid} style={styles.weeklyTopEntry} numberOfLines={1}>
                  {['🥇', '🥈', '🥉'][i]} {e.username}
                </Text>
              ))}
            </View>
          )}
        </TouchableOpacity>

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
            <Button label="SHOP"       onPress={() => router.push('/shop')}       variant="secondary" style={styles.thirdBtn} />
            <Button label="📤 INVITE"  onPress={openInvite}                       variant="secondary" style={styles.thirdBtn} />
            <Button label="⚡"          onPress={() => router.push('/challenges')} variant="secondary" style={styles.iconBtn} />
          </View>
          <View style={styles.secondaryRow}>
            <Button label="🏆 LEADERBOARD" onPress={() => router.push('/leaderboard')} variant="ghost" style={styles.halfGhost} />
            <Button label="👑 WEEKLY"      onPress={() => router.push('/weekly')}      variant="ghost" style={styles.halfGhost} />
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

  // ── Challenge banner ──────────────────────────────────────────────────────
  challengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  challengeBannerDone: {
    borderColor: 'rgba(76,175,80,0.35)',
    backgroundColor: 'rgba(76,175,80,0.07)',
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerIcon: { fontSize: 20 },
  bannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 3,
  },
  bannerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  dotRow: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  dotFilled: { backgroundColor: Colors.gold },

  // ── Hero ─────────────────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: { gap: 14, alignItems: 'center' },
  playBtn:     { paddingVertical: 18, minWidth: 220 },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  thirdBtn:  { flex: 1, maxWidth: 140, minWidth: 0 },
  iconBtn:   { width: 52, paddingHorizontal: 0 },
  halfGhost: { flex: 1, minWidth: 0 },

  // ── Weekly widget ─────────────────────────────────────────────────────────
  weeklyWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  weeklyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  weeklyIcon: { fontSize: 20 },
  weeklyTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 3,
  },
  weeklyCountdown: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 2,
    marginTop: 2,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  weeklyTop3: { alignItems: 'flex-end', gap: 2 },
  weeklyTopEntry: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    maxWidth: 120,
  },

  hint: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 24,
    opacity: 0.7,
  },
});
