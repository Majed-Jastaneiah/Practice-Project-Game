import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDailyChallenges,
  claimChallengeReward,
  BONUS_REWARD,
  type ChallengeDoc,
  type DailyChallenge,
} from '@/services/challengeService';
import {
  getInventory,
  POWERUP_META,
  type PowerUpInventory,
  type PowerUpKind,
} from '@/services/powerUpService';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const pct = Math.min(progress / target, 1);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

function ChallengeCard({
  challenge,
  onClaim,
  claiming,
}: {
  challenge: DailyChallenge;
  onClaim: (id: string) => void;
  claiming: boolean;
}) {
  const pct     = Math.min(challenge.progress / challenge.target, 1);
  const pctText = challenge.target === 1
    ? challenge.completed ? '1 / 1' : '0 / 1'
    : `${Math.min(challenge.progress, challenge.target)} / ${challenge.target}`;

  return (
    <View style={[styles.card, challenge.claimed && styles.cardClaimed]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{challenge.label}</Text>
        <Text style={styles.rewardBadge}>+{challenge.reward} 🪙</Text>
      </View>

      <Text style={styles.cardDesc}>{challenge.description}</Text>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <ProgressBar progress={challenge.progress} target={challenge.target} />
        <Text style={styles.progressText}>{pctText}</Text>
      </View>

      {/* Claim button */}
      {challenge.completed && !challenge.claimed && (
        <TouchableOpacity
          style={styles.claimBtn}
          onPress={() => onClaim(challenge.id)}
          disabled={claiming}
        >
          {claiming ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.claimBtnText}>CLAIM REWARD</Text>
          )}
        </TouchableOpacity>
      )}

      {challenge.claimed && (
        <View style={styles.claimedRow}>
          <Text style={styles.claimedText}>✓  Claimed</Text>
        </View>
      )}
    </View>
  );
}

function PowerUpSlot({ kind, count }: { kind: PowerUpKind; count: number }) {
  const meta = POWERUP_META[kind];
  return (
    <View style={[styles.puSlot, count === 0 && styles.puSlotEmpty]}>
      <Text style={styles.puIcon}>{meta.icon}</Text>
      <Text style={styles.puCount}>×{count}</Text>
      <Text style={styles.puLabel}>{meta.label}</Text>
      <Text style={styles.puDesc} numberOfLines={2}>{meta.description}</Text>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChallengesScreen() {
  const { user } = useAuth();

  const [doc,        setDoc]        = useState<ChallengeDoc | null>(null);
  const [inventory,  setInventory]  = useState<PowerUpInventory | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming,   setClaiming]   = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [d, inv] = await Promise.all([
        getDailyChallenges(user.uid),
        getInventory(user.uid),
      ]);
      setDoc(d);
      setInventory(inv);
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleClaim = useCallback(async (id: string) => {
    if (!user || !doc) return;
    setClaiming(id);
    try {
      const result = await claimChallengeReward(user.uid, id);
      if (result.ok) {
        showToast(`+${result.coinsAwarded} 🪙 claimed!`);
        await load();
      }
    } finally {
      setClaiming(null);
    }
  }, [user, doc, load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const completedCount = doc?.challenges.filter((c) => c.completed).length ?? 0;
  const claimedCount   = doc?.challenges.filter((c) => c.claimed).length   ?? 0;

  return (
    <SafeAreaView style={styles.safe}>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

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
          <Text style={styles.title}>DAILY CHALLENGES</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Streak stats */}
        <View style={styles.statsRow}>
          <StatChip label="LOGIN STREAK"     value={`${doc?.loginStreak ?? 0}d 🔥`} />
          <StatChip label="CHALLENGE STREAK" value={`${doc?.challengeStreak ?? 0}d ⚡`} />
          <StatChip label="TODAY"            value={`${completedCount}/3`} />
        </View>

        {/* Badges */}
        {(doc?.badges ?? []).length > 0 && (
          <View style={styles.badgeRow}>
            {doc!.badges.map((b, i) => (
              <View key={i} style={styles.badge}>
                <Text style={styles.badgeText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Daily challenges */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY'S CHALLENGES</Text>

          {(doc?.challenges ?? []).map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              onClaim={handleClaim}
              claiming={claiming === c.id}
            />
          ))}

          {/* All-3 bonus hint */}
          {!doc?.bonusClaimed && (
            <View style={styles.bonusHint}>
              <Text style={styles.bonusHintText}>
                Complete all 3 challenges to earn a bonus{' '}
                <Text style={styles.bonusGold}>+{BONUS_REWARD} 🪙</Text>
              </Text>
            </View>
          )}
          {doc?.bonusClaimed && (
            <View style={[styles.bonusHint, styles.bonusClaimed]}>
              <Text style={styles.bonusClaimedText}>✓  All-3 bonus claimed today!</Text>
            </View>
          )}
        </View>

        {/* Power-up inventory */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>POWER-UP INVENTORY</Text>
          <Text style={styles.sectionSub}>
            Earned through challenge streaks. Activate in-game by tapping the HUD icon.
          </Text>

          <View style={styles.puGrid}>
            {(Object.keys(POWERUP_META) as PowerUpKind[]).map((kind) => (
              <PowerUpSlot key={kind} kind={kind} count={inventory?.[kind] ?? 0} />
            ))}
          </View>
        </View>

        {/* Streak reward guide */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STREAK REWARDS</Text>
          {[
            { label: '3-day login streak',             reward: '20 🪙' },
            { label: '7-day login streak',             reward: '50 🪙 + 🥉 Bronze Badge' },
            { label: '7-day challenge streak',         reward: '75 🪙 + 🥈 Silver Badge + ⏱️ ×1' },
            { label: '30-day login streak',            reward: '200 🪙 + 🥇 Gold Badge' },
            { label: '30-day challenge streak',        reward: '300 🪙 + 🏆 Legendary Badge + ⏱️ ×3' },
          ].map((r, i) => (
            <View key={i} style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>{r.label}</Text>
              <Text style={styles.rewardValue}>{r.reward}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

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
    fontSize: 14,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 4,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 16 },
  chip: {
    flex: 1,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  chipValue: { fontSize: 15, fontWeight: '800', color: Colors.gold },
  chipLabel: { fontSize: 9,  fontWeight: '700', color: Colors.textSecondary, letterSpacing: 2 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  badge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  badgeText: { fontSize: 12, color: Colors.gold, fontWeight: '600' },

  section:      { marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 4, color: Colors.gold, marginBottom: 6 },
  sectionSub:   { fontSize: 12, color: Colors.textSecondary, marginBottom: 14, lineHeight: 18 },

  // ── Challenge card ──
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardClaimed: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: '#FFFFFF', flex: 1 },
  rewardBadge: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '700',
    marginLeft: 8,
  },
  cardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  progressText: { fontSize: 11, color: Colors.textSecondary, minWidth: 40, textAlign: 'right' },

  claimBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  claimBtnText: { fontSize: 13, fontWeight: '900', color: Colors.background, letterSpacing: 2 },

  claimedRow: { alignItems: 'center' },
  claimedText: { fontSize: 12, color: '#4CAF50', fontWeight: '700', letterSpacing: 1 },

  bonusHint: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bonusClaimed: { borderColor: 'rgba(76,175,80,0.3)', backgroundColor: 'rgba(76,175,80,0.06)' },
  bonusHintText:   { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  bonusGold:       { color: Colors.gold, fontWeight: '700' },
  bonusClaimedText: { fontSize: 13, color: '#4CAF50', fontWeight: '700', letterSpacing: 1 },

  // ── Power-up grid ──
  puGrid: { flexDirection: 'row', gap: 10 },
  puSlot: {
    flex: 1,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  puSlotEmpty: { opacity: 0.45 },
  puIcon:  { fontSize: 28 },
  puCount: { fontSize: 18, fontWeight: '900', color: Colors.gold },
  puLabel: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1, textAlign: 'center' },
  puDesc:  { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', lineHeight: 14 },

  // ── Streak guide ──
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  rewardLabel: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  rewardValue: { fontSize: 12, color: Colors.gold, fontWeight: '700', textAlign: 'right' },

  // ── Toast ──
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: Colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    zIndex: 99,
  },
  toastText: { fontSize: 14, fontWeight: '800', color: Colors.background },
});
