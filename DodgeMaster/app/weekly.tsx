import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCurrentWeekKey,
  getWeekEndTime,
  formatCountdown,
  formatWeekRange,
  getWeeklyTopScores,
  getPlayerWeeklyRank,
  getHallOfFame,
  checkAndClaimWeeklyReward,
  type WeeklyScore,
  type WeeklyChampion,
  type RewardResult,
} from '@/services/weeklyChampionService';

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(): string {
  const [label, setLabel] = useState(() =>
    formatCountdown(getWeekEndTime().getTime() - Date.now()),
  );
  useEffect(() => {
    const tick = () => setLabel(formatCountdown(getWeekEndTime().getTime() - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return label;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function ScoreRow({
  entry,
  isMe,
}: {
  entry: WeeklyScore;
  isMe: boolean;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  const isTop3 = entry.rank <= 3;
  const medalColors = [Colors.gold, '#C0C0C0', '#CD7F32'];
  const color = isTop3 ? medalColors[entry.rank - 1] : isMe ? Colors.gold : '#FFFFFF';

  return (
    <TouchableOpacity
      style={[styles.scoreRow, isMe && styles.scoreRowMe, isTop3 && styles.scoreRowTop3]}
      onPress={() => router.push(`/profile/${entry.username}`)}
      activeOpacity={0.75}
    >
      <View style={styles.rankCell}>
        {isTop3 ? (
          <Text style={styles.medal}>{medals[entry.rank - 1]}</Text>
        ) : (
          <Text style={[styles.rankNum, isMe && { color: Colors.gold }]}>{entry.rank}</Text>
        )}
      </View>
      <Text style={styles.flagCell}>{entry.countryFlag || '🌍'}</Text>
      <Text style={[styles.nameCell, { color }]} numberOfLines={1}>
        {entry.username}{isMe ? '  ★' : ''}
      </Text>
      <Text style={[styles.scoreCell, { color }]}>{entry.score}s</Text>
    </TouchableOpacity>
  );
}

function HallOfFameCard({
  weekKey,
  champions,
}: {
  weekKey: string;
  champions: WeeklyChampion[];
}) {
  const top3 = champions.slice(0, 3);
  const rest = champions.length - 3;
  return (
    <View style={styles.hofCard}>
      <Text style={styles.hofWeek}>{formatWeekRange(weekKey)}</Text>
      {top3.map((c, i) => (
        <TouchableOpacity
          key={c.uid}
          style={styles.hofRow}
          onPress={() => router.push(`/profile/${c.username}`)}
          activeOpacity={0.75}
        >
          <Text style={styles.hofMedal}>{['🥇', '🥈', '🥉'][i]}</Text>
          <Text style={styles.hofName} numberOfLines={1}>{c.username}</Text>
          <Text style={styles.hofScore}>{c.score}s</Text>
        </TouchableOpacity>
      ))}
      {rest > 0 && (
        <Text style={styles.hofMore}>+{rest} more champions</Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyScreen() {
  const { user } = useAuth();
  const countdown = useCountdown();

  const [topScores,   setTopScores]   = useState<WeeklyScore[]>([]);
  const [playerRank,  setPlayerRank]  = useState<{ rank: number; score: number; isTop1Percent: boolean; total: number } | null>(null);
  const [hallOfFame,  setHallOfFame]  = useState<Array<{ weekKey: string; champions: WeeklyChampion[] }>>([]);
  const [reward,      setReward]      = useState<RewardResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    const weekKey = getCurrentWeekKey();
    try {
      const [scores, hof] = await Promise.all([
        getWeeklyTopScores(weekKey, 10),
        getHallOfFame(3),
      ]);
      setTopScores(scores);
      setHallOfFame(hof);

      if (user) {
        const [rank, rewardResult] = await Promise.all([
          getPlayerWeeklyRank(user.uid, weekKey),
          checkAndClaimWeeklyReward(user.uid),
        ]);
        setPlayerRank(rank);
        if (rewardResult.rewarded) setReward(rewardResult);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const weekKey   = getCurrentWeekKey();
  const weekRange = formatWeekRange(weekKey);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>WEEKLY{'\n'}CHAMPIONSHIP</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Reward banner */}
        {reward?.rewarded && (
          <View style={styles.rewardBanner}>
            <Text style={styles.rewardText}>{reward.notification}</Text>
            {reward.newBadges && reward.newBadges.length > 0 && (
              <Text style={styles.rewardBadges}>
                New: {reward.newBadges.join('  ')}
              </Text>
            )}
          </View>
        )}

        {/* Countdown */}
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>ENDS IN</Text>
          <Text style={styles.countdown}>{countdown}</Text>
          <Text style={styles.countdownWeek}>{weekRange}</Text>
        </View>

        {/* Player rank */}
        {user && playerRank && playerRank.rank > 0 && (
          <View style={[
            styles.rankCard,
            playerRank.isTop1Percent && styles.rankCardChampion,
          ]}>
            <View style={styles.rankCardLeft}>
              {playerRank.isTop1Percent && (
                <Text style={styles.rankCrown}>👑</Text>
              )}
              <View>
                <Text style={styles.rankCardLabel}>YOUR WEEKLY RANK</Text>
                <Text style={styles.rankCardValue}>
                  #{playerRank.rank}
                  <Text style={styles.rankCardOf}> of {playerRank.total.toLocaleString()}</Text>
                </Text>
              </View>
            </View>
            <View style={styles.rankCardRight}>
              <Text style={styles.rankCardScore}>{playerRank.score}s</Text>
              <Text style={[
                styles.rankCardStatus,
                playerRank.isTop1Percent && { color: Colors.gold },
              ]}>
                {playerRank.isTop1Percent
                  ? '🏆 TOP 1%'
                  : `Top ${Math.ceil((playerRank.rank / Math.max(playerRank.total, 1)) * 100)}%`}
              </Text>
            </View>
          </View>
        )}

        {/* Top 10 this week */}
        <SectionHeader title={`TOP 10 THIS WEEK`} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : topScores.length === 0 ? (
          <Text style={styles.empty}>No scores yet this week.{'\n'}Be the first to climb!</Text>
        ) : (
          <View style={styles.list}>
            {topScores.map((entry) => (
              <ScoreRow
                key={entry.uid}
                entry={entry}
                isMe={entry.uid === user?.uid}
              />
            ))}
          </View>
        )}

        {/* Rewards info */}
        <SectionHeader title="CHAMPION REWARDS" />
        <View style={styles.rewardsGrid}>
          {[
            { icon: '👑', label: 'Champion status on profile & leaderboard' },
            { icon: '🪙', label: '300 coins automatically credited' },
            { icon: '⬆️', label: 'Instant rank boost to next tier' },
            { icon: '🏆', label: 'Weekly Champion badge on profile' },
          ].map((r, i) => (
            <View key={i} style={styles.rewardItem}>
              <Text style={styles.rewardIcon}>{r.icon}</Text>
              <Text style={styles.rewardLabel}>{r.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.badgeMilestones}>
          <Text style={styles.badgeMilestonesTitle}>WIN MILESTONES</Text>
          {[
            { wins: '1×',  badge: '👑 Weekly Champion Badge' },
            { wins: '3×',  badge: '🥇 Triple Champion Badge'  },
            { wins: '5×',  badge: '⭐ Elite Champion Badge'   },
            { wins: '10×', badge: '🏆 Dynasty Badge'          },
          ].map((m, i) => (
            <View key={i} style={styles.milestoneRow}>
              <Text style={styles.milestoneWins}>{m.wins}</Text>
              <Text style={styles.milestoneBadge}>{m.badge}</Text>
            </View>
          ))}
        </View>

        {/* Hall of fame */}
        {hallOfFame.length > 0 && (
          <>
            <SectionHeader title="HALL OF FAME" />
            {hallOfFame.map(({ weekKey: wk, champions }) => (
              <HallOfFameCard key={wk} weekKey={wk} champions={champions} />
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  center: { paddingVertical: 24, alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 8,
  },
  backBtn:  { width: 60 },
  backText: { color: Colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // ── Reward banner ─────────────────────────────────────────────────────────
  rewardBanner: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.45)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  rewardText:   { fontSize: 14, fontWeight: '700', color: Colors.gold, textAlign: 'center' },
  rewardBadges: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },

  // ── Countdown ─────────────────────────────────────────────────────────────
  countdownCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    borderRadius: 16,
    paddingVertical: 22,
    marginBottom: 16,
    gap: 6,
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 5,
    color: Colors.textSecondary,
  },
  countdown: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 4,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  countdownWeek: { fontSize: 12, color: Colors.textSecondary },

  // ── Player rank card ──────────────────────────────────────────────────────
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  rankCardChampion: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderColor: 'rgba(255,215,0,0.45)',
  },
  rankCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankCrown:     { fontSize: 24 },
  rankCardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 3, color: Colors.textSecondary },
  rankCardValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  rankCardOf:    { fontSize: 14, fontWeight: '400', color: Colors.textSecondary },
  rankCardRight: { alignItems: 'flex-end', gap: 4 },
  rankCardScore: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  rankCardStatus: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 4, color: Colors.gold },
  sectionLine:  { flex: 1, height: 1, backgroundColor: 'rgba(255,215,0,0.18)' },

  // ── Score list ────────────────────────────────────────────────────────────
  list:  { gap: 4 },
  empty: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingVertical: 16 },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 8,
  },
  scoreRowTop3: {
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.18)',
  },
  scoreRowMe: {
    backgroundColor: 'rgba(255,215,0,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.45)',
  },
  rankCell:  { width: 34, alignItems: 'center' },
  medal:     { fontSize: 20 },
  rankNum:   { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  flagCell:  { fontSize: 16 },
  nameCell:  { flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  scoreCell: { fontSize: 16, fontWeight: '800', minWidth: 48, textAlign: 'right' },

  // ── Rewards grid ──────────────────────────────────────────────────────────
  rewardsGrid: { gap: 10, marginBottom: 14 },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rewardIcon:  { fontSize: 22 },
  rewardLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // ── Badge milestones ──────────────────────────────────────────────────────
  badgeMilestones: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.18)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  badgeMilestonesTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
    color: Colors.gold,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  milestoneWins:  { fontSize: 13, fontWeight: '800', color: Colors.gold, width: 32 },
  milestoneBadge: { fontSize: 13, color: '#FFFFFF' },

  // ── Hall of fame ──────────────────────────────────────────────────────────
  hofCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 2,
  },
  hofWeek:  { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: Colors.gold, marginBottom: 8 },
  hofRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  hofMedal: { fontSize: 16 },
  hofName:  { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  hofScore: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  hofMore:  { fontSize: 11, color: Colors.textSecondary, marginTop: 4, opacity: 0.7 },
});
