import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { Colors } from '@/constants/Colors';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getRankForScore } from '@/constants/Ranks';

interface ProfileData {
  uid: string;
  username: string;
  score: number;
  weeklyScore: number;
  country: string;
  countryFlag: string;
  gamesPlayed: number;
  streak: number;
  badges: string[];
  weeklyChampions: string[];
  adminStars: number;
  hasGoldPack: boolean;
  memberSince: number;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function formatMemberSince(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatWeekLabel(week: string): string {
  // Expects 'YYYY-WNN' format, e.g. '2024-W03'
  const [year, w] = week.split('-W');
  return w ? `Week ${w}, ${year}` : week;
}

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser } = useAuth();

  const [profile, setProfile]   = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        // Resolve username → uid via the usernames registry
        const usernameSnap = await getDoc(
          doc(db, 'usernames', (username as string).toLowerCase()),
        );
        if (!usernameSnap.exists()) {
          setNotFound(true);
          return;
        }
        const uid = usernameSnap.data().uid as string;

        // Fetch base user doc + leaderboard/stats doc in parallel
        const [userSnap, statsSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDoc(doc(db, 'leaderboard', uid)),
        ]);

        const u = userSnap.data()  ?? {};
        const s = statsSnap.data() ?? {};

        setProfile({
          uid,
          username:        u.username         ?? (username as string),
          score:           s.score            ?? 0,
          weeklyScore:     s.weeklyScore      ?? 0,
          country:         s.country          ?? '',
          countryFlag:     s.countryFlag      ?? '',
          gamesPlayed:     s.gamesPlayed      ?? 0,
          streak:          s.streak           ?? 0,
          badges:          s.badges           ?? [],
          weeklyChampions: s.weeklyChampions  ?? [],
          adminStars:      s.adminStars       ?? 0,
          hasGoldPack:     s.hasGoldPack      ?? false,
          memberSince:     u.createdAt        ?? Date.now(),
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [username]);

  const isOwnProfile = profile?.uid === currentUser?.uid;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFoundEmoji}>👤</Text>
          <Text style={styles.notFoundTitle}>Player not found</Text>
          <Text style={styles.notFoundSub}>@{username}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tier = getRankForScore(profile.score);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Gold Pack crown */}
          {profile.hasGoldPack && (
            <Text style={styles.crown}>👑 GOLD PACK</Text>
          )}

          {/* Username */}
          <Text style={styles.heroUsername}>
            {profile.username}
          </Text>

          {/* Flag + country */}
          {(profile.countryFlag || profile.country) && (
            <Text style={styles.heroCountry}>
              {profile.countryFlag}  {profile.country}
            </Text>
          )}

          {/* Admin stars */}
          {profile.adminStars > 0 && (
            <Text style={styles.adminStars}>
              {'★'.repeat(Math.min(profile.adminStars, 10))}
            </Text>
          )}

          {/* Member since */}
          <Text style={styles.memberSince}>
            Member since {formatMemberSince(profile.memberSince)}
          </Text>

          {isOwnProfile && (
            <Text style={styles.ownTag}>— your profile —</Text>
          )}
        </View>

        {/* ── Rank tier card ── */}
        <View style={styles.rankCard}>
          <Text style={styles.rankEmoji}>{tier.emoji}</Text>
          <Text style={styles.rankName}>{tier.label.toUpperCase()}</Text>
          <Text style={styles.rankDesc}>
            All‑time best  ·  {profile.score}s survived
          </Text>
        </View>

        {/* ── Stats grid ── */}
        <SectionHeader title="STATS" />
        <View style={styles.statsGrid}>
          <StatCard label="ALL TIME BEST" value={`${profile.score}s`} />
          <StatCard label="WEEKLY BEST"   value={`${profile.weeklyScore}s`} />
          <StatCard label="GAMES PLAYED"  value={profile.gamesPlayed} />
          <StatCard label="CURRENT STREAK" value={`${profile.streak}d`} />
        </View>

        {/* ── Badges ── */}
        {profile.badges.length > 0 && (
          <>
            <SectionHeader title="BADGES" />
            <View style={styles.badgeRow}>
              {profile.badges.map((badge, i) => (
                <View key={i} style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Weekly champion history ── */}
        {profile.weeklyChampions.length > 0 && (
          <>
            <SectionHeader title="WEEKLY CHAMPION" />
            <View style={styles.champRow}>
              {profile.weeklyChampions.map((week, i) => (
                <View key={i} style={styles.champChip}>
                  <Text style={styles.champIcon}>🏆</Text>
                  <Text style={styles.champLabel}>{formatWeekLabel(week)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },

  backBtn: { paddingTop: 14, paddingBottom: 8 },
  backText: { color: Colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  crown: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 4,
  },
  heroUsername: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 2,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    textAlign: 'center',
  },
  heroCountry: {
    fontSize: 15,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  adminStars: {
    fontSize: 18,
    color: Colors.gold,
    letterSpacing: 4,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  memberSince: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  ownTag: { fontSize: 11, color: 'rgba(255,215,0,0.45)', letterSpacing: 2, marginTop: 2 },

  // ── Rank card ─────────────────────────────────────────────────────────────
  rankCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    marginBottom: 28,
    gap: 6,
  },
  rankEmoji: { fontSize: 48 },
  rankName: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 5,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  rankDesc: { fontSize: 12, color: Colors.textSecondary, letterSpacing: 1 },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    color: Colors.gold,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,215,0,0.18)' },

  // ── Stats grid ────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.12)',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Badges ────────────────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  badge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  badgeText: { fontSize: 13, color: Colors.gold, fontWeight: '600' },

  // ── Weekly champion ───────────────────────────────────────────────────────
  champRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  champChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  champIcon: { fontSize: 14 },
  champLabel: { fontSize: 12, color: Colors.gold, fontWeight: '600' },

  // ── Not found ─────────────────────────────────────────────────────────────
  notFoundEmoji: { fontSize: 48, marginBottom: 12 },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  notFoundSub: { fontSize: 14, color: Colors.textSecondary },

  bottomPad: { height: 24 },
});
