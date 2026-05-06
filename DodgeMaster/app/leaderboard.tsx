import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { Colors } from '@/constants/Colors';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getRankForScore } from '@/constants/Ranks';

type Tab = 'alltime' | 'weekly' | 'country';

interface LeaderboardEntry {
  uid: string;
  username: string;
  score: number;
  weeklyScore: number;
  country: string;
  countryFlag: string;
  position: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = [Colors.gold, '#C0C0C0', '#CD7F32'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'alltime',  label: 'ALL TIME' },
  { key: 'weekly',   label: 'WEEKLY'   },
  { key: 'country',  label: 'COUNTRY'  },
];

export default function LeaderboardScreen() {
  const { user } = useAuth();

  const [activeTab, setActiveTab]         = useState<Tab>('alltime');
  const [entries, setEntries]             = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [userCountry, setUserCountry]     = useState<string | null>(null);
  const [userCountryFlag, setUserCountryFlag] = useState('');

  // Load current user's country once (needed for country tab filter)
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'leaderboard', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setUserCountry(snap.data().country ?? null);
          setUserCountryFlag(snap.data().countryFlag ?? '');
        }
      })
      .catch(() => {});
  }, [user]);

  const fetchEntries = useCallback(
    async (tab: Tab) => {
      try {
        let q;
        if (tab === 'alltime') {
          q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(50));
        } else if (tab === 'weekly') {
          q = query(collection(db, 'leaderboard'), orderBy('weeklyScore', 'desc'), limit(50));
        } else {
          if (!userCountry) { setEntries([]); return; }
          q = query(
            collection(db, 'leaderboard'),
            where('country', '==', userCountry),
            orderBy('score', 'desc'),
            limit(50),
          );
        }
        const snap = await getDocs(q);
        setEntries(
          snap.docs.map((d, idx) => ({
            uid:         d.id,
            username:    d.data().username    ?? 'Unknown',
            score:       d.data().score       ?? 0,
            weeklyScore: d.data().weeklyScore ?? 0,
            country:     d.data().country     ?? '',
            countryFlag: d.data().countryFlag ?? '',
            position:    idx + 1,
          })),
        );
      } catch {
        setEntries([]);
      }
    },
    [userCountry],
  );

  useEffect(() => {
    setLoading(true);
    fetchEntries(activeTab).finally(() => setLoading(false));
  }, [activeTab, fetchEntries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEntries(activeTab);
    setRefreshing(false);
  }, [activeTab, fetchEntries]);

  const displayScore = (e: LeaderboardEntry) =>
    activeTab === 'weekly' ? e.weeklyScore : e.score;

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe    = item.uid === user?.uid;
    const isTop3  = item.position <= 3;
    const tier    = getRankForScore(item.score);
    const mColor  = isTop3 ? MEDAL_COLORS[item.position - 1] : null;

    return (
      <TouchableOpacity
        style={[styles.row, isTop3 && styles.rowTop3, isMe && styles.rowMe]}
        onPress={() => router.push(`/profile/${item.username}`)}
        activeOpacity={0.75}
      >
        {/* Position / medal */}
        <View style={styles.positionCell}>
          {isTop3 ? (
            <Text style={styles.medal}>{MEDALS[item.position - 1]}</Text>
          ) : (
            <Text style={[styles.position, isMe && { color: Colors.gold }]}>
              {item.position}
            </Text>
          )}
        </View>

        {/* Country flag */}
        <Text style={styles.flag}>{item.countryFlag || '🌍'}</Text>

        {/* Name + rank tier */}
        <View style={styles.nameCell}>
          <Text
            style={[
              styles.username,
              isMe && styles.usernameMe,
              mColor ? { color: mColor } : null,
            ]}
            numberOfLines={1}
          >
            {item.username}{isMe ? '  ★' : ''}
          </Text>
          <Text style={styles.tierLabel}>{tier.emoji} {tier.label}</Text>
        </View>

        {/* Score */}
        <Text
          style={[
            styles.score,
            isMe   && { color: Colors.gold },
            mColor && { color: mColor },
          ]}
        >
          {displayScore(item)}s
        </Text>
      </TouchableOpacity>
    );
  };

  const countryTabLabel =
    userCountryFlag ? `${userCountryFlag} COUNTRY` : 'COUNTRY';

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>LEADERBOARD</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.key === 'country' ? countryTabLabel : t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>
            {activeTab === 'country' && !userCountry
              ? 'Set your country in your\nprofile to see this board.'
              : 'No scores yet.\nBe the first to climb!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.gold}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { width: 64 },
  backText: { color: Colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  headerSpacer: { width: 64 },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 5,
    textShadowColor: Colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.15)',
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.gold,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.textSecondary,
  },
  tabTextActive: { color: Colors.gold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  list: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowTop3: {
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.18)',
  },
  rowMe: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
  },

  positionCell: { width: 36, alignItems: 'center' },
  medal:    { fontSize: 20 },
  position: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  flag: { fontSize: 18, marginRight: 10 },

  nameCell: { flex: 1, gap: 3 },
  username: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  usernameMe: { color: Colors.gold },
  tierLabel: { fontSize: 11, color: Colors.textSecondary },

  score: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    minWidth: 52,
    textAlign: 'right',
  },
});
