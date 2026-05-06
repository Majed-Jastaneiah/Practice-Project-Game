/**
 * Weekly championship service.
 *
 * Week: Monday 00:00 UTC → Sunday 23:59:59 UTC.
 * weekKey = Monday date string "YYYY-MM-DD" (e.g. "2025-05-05").
 *
 * Firestore layout — add these to firestore.rules.example:
 *
 *   // Weekly scores — each player writes only their own entry
 *   match /weeklyScores/{weekKey}/players/{userId} {
 *     allow read: if request.auth != null;
 *     allow write: if request.auth != null && request.auth.uid == userId;
 *   }
 *   // Champion registry — any authenticated user can trigger calculation
 *   match /weeklyChampions/{weekKey} {
 *     allow read: if request.auth != null;
 *     allow create, update: if request.auth != null;
 *   }
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { addCoins } from './coinService';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_PERCENT      = 0.01;  // top 1%
const CHAMPION_COINS   = 300;

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeeklyBadge =
  | '👑 Weekly Champion'
  | '🥇 Triple Champion'
  | '⭐ Elite Champion'
  | '🏆 Dynasty';

export interface WeeklyScore {
  uid: string;
  username: string;
  score: number;
  countryFlag: string;
  rank: number;
}

export interface WeeklyChampion {
  uid: string;
  username: string;
  score: number;
  countryFlag: string;
}

export interface WeekChampionDoc {
  weekKey: string;
  champions: WeeklyChampion[];
  top1PercentThreshold: number;
  totalPlayers: number;
  announced: boolean;
  announcedAt?: number;
}

export interface PlayerWeeklyRank {
  rank: number;
  score: number;
  isTop1Percent: boolean;
  total: number;
}

export interface RewardResult {
  rewarded: boolean;
  weekKey?: string;
  coinsAwarded?: number;
  newBadges?: WeeklyBadge[];
  notification?: string;
}

// ─── Week key helpers ─────────────────────────────────────────────────────────

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d;
}

export function getCurrentWeekKey(): string {
  return mondayOf(new Date()).toISOString().split('T')[0];
}

export function getPreviousWeekKey(): string {
  const m = mondayOf(new Date());
  m.setUTCDate(m.getUTCDate() - 7);
  return m.toISOString().split('T')[0];
}

export function getWeekEndTime(): Date {
  const sunday = mondayOf(new Date());
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday;
}

function weekEndForKey(weekKey: string): Date {
  const monday = new Date(weekKey + 'T00:00:00.000Z');
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s   = Math.floor(ms / 1000);
  const d   = Math.floor(s / 86400);
  const h   = Math.floor((s % 86400) / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d  ${String(h).padStart(2, '0')}h  ${String(m).padStart(2, '0')}m`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** "May 5 – May 11" */
export function formatWeekRange(weekKey: string): string {
  const monday = new Date(weekKey + 'T00:00:00.000Z');
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', fmt)} – ${sunday.toLocaleDateString('en-US', fmt)}`;
}

// ─── Score submission ─────────────────────────────────────────────────────────

/** Submit (or improve) the player's best score for the current week. */
export async function submitWeeklyScore(
  uid: string,
  username: string,
  score: number,
  countryFlag = '',
): Promise<void> {
  const weekKey = getCurrentWeekKey();
  const ref     = doc(db, 'weeklyScores', weekKey, 'players', uid);
  const snap    = await getDoc(ref);
  if (snap.exists() && (snap.data().score ?? 0) >= score) return; // not a new best
  await setDoc(ref, { uid, username, score, countryFlag, weekKey, updatedAt: Date.now() });
}

// ─── Leaderboard reads ────────────────────────────────────────────────────────

/** Top N scores for the given week, sorted by score desc. */
export async function getWeeklyTopScores(weekKey: string, n = 10): Promise<WeeklyScore[]> {
  const snap = await getDocs(
    query(collection(db, 'weeklyScores', weekKey, 'players'), orderBy('score', 'desc'), limit(n)),
  );
  return snap.docs.map((d, i) => ({
    uid:         d.data().uid,
    username:    d.data().username    ?? 'Unknown',
    score:       d.data().score       ?? 0,
    countryFlag: d.data().countryFlag ?? '',
    rank:        i + 1,
  }));
}

/** The current player's rank, score, and top-1% status for the given week. */
export async function getPlayerWeeklyRank(uid: string, weekKey: string): Promise<PlayerWeeklyRank> {
  const playerSnap = await getDoc(doc(db, 'weeklyScores', weekKey, 'players', uid));
  if (!playerSnap.exists()) return { rank: 0, score: 0, isTop1Percent: false, total: 0 };

  const playerScore = playerSnap.data().score ?? 0;

  const [higherSnap, allSnap] = await Promise.all([
    getDocs(query(collection(db, 'weeklyScores', weekKey, 'players'), where('score', '>', playerScore))),
    getDocs(collection(db, 'weeklyScores', weekKey, 'players')),
  ]);

  const rank  = higherSnap.size + 1;
  const total = allSnap.size;
  const isTop1Percent = rank <= Math.max(1, Math.ceil(total * TOP_PERCENT));

  return { rank, score: playerScore, isTop1Percent, total };
}

// ─── Champion calculation ─────────────────────────────────────────────────────

/**
 * Fetches (or lazily calculates) the champion list for a completed week.
 * Safe to call from multiple clients — uses an `announced` guard.
 */
export async function getOrCalculateChampions(weekKey: string): Promise<WeekChampionDoc | null> {
  const ref  = doc(db, 'weeklyChampions', weekKey);
  const snap = await getDoc(ref);

  if (snap.exists() && snap.data().announced) {
    return snap.data() as WeekChampionDoc;
  }

  // Only calculate if the week has actually ended
  if (Date.now() < weekEndForKey(weekKey).getTime()) return null;

  const allSnap = await getDocs(
    query(collection(db, 'weeklyScores', weekKey, 'players'), orderBy('score', 'desc')),
  );
  const total = allSnap.size;
  if (total === 0) return null;

  const top1Count  = Math.max(1, Math.ceil(total * TOP_PERCENT));
  const topDocs    = allSnap.docs.slice(0, top1Count);
  const champions: WeeklyChampion[] = topDocs.map((d) => ({
    uid:         d.data().uid,
    username:    d.data().username    ?? 'Unknown',
    score:       d.data().score       ?? 0,
    countryFlag: d.data().countryFlag ?? '',
  }));

  const champDoc: WeekChampionDoc = {
    weekKey,
    champions,
    top1PercentThreshold: topDocs[topDocs.length - 1]?.data().score ?? 0,
    totalPlayers: total,
    announced: true,
    announcedAt: Date.now(),
  };

  await setDoc(ref, champDoc);
  return champDoc;
}

// ─── Reward distribution ──────────────────────────────────────────────────────

function badgesForWinCount(wins: number): WeeklyBadge[] {
  const b: WeeklyBadge[] = [];
  if (wins >= 1)  b.push('👑 Weekly Champion');
  if (wins >= 3)  b.push('🥇 Triple Champion');
  if (wins >= 5)  b.push('⭐ Elite Champion');
  if (wins >= 10) b.push('🏆 Dynasty');
  return b;
}

/**
 * Checks if the current user won last week's championship and distributes
 * rewards if they haven't been claimed yet. Call once on app open.
 */
export async function checkAndClaimWeeklyReward(uid: string): Promise<RewardResult> {
  const prevKey  = getPreviousWeekKey();
  const champDoc = await getOrCalculateChampions(prevKey);
  if (!champDoc) return { rewarded: false };

  const isChampion = champDoc.champions.some((c) => c.uid === uid);
  if (!isChampion) return { rewarded: false };

  const userSnap = await getDoc(doc(db, 'users', uid));
  const userData = userSnap.data() ?? {};
  if (userData.lastClaimedWeek === prevKey) return { rewarded: false }; // already claimed

  // Distribute rewards
  await addCoins(CHAMPION_COINS);

  const totalWins = (userData.weeklyChampionCount ?? 0) + 1;
  const newBadges = badgesForWinCount(totalWins);

  await setDoc(doc(db, 'users', uid), {
    weeklyChampionCount:   totalWins,
    isCurrentWeekChampion: false, // resets each new week
    lastChampionWeek:      prevKey,
    lastClaimedWeek:       prevKey,
    weeklyBadges:          newBadges,
  }, { merge: true });

  await setDoc(doc(db, 'leaderboard', uid), {
    weeklyChampionCount: totalWins,
    weeklyBadges:        newBadges,
    hasGoldPack:         true, // weekly champs earn Gold Pack status
  }, { merge: true });

  return {
    rewarded:     true,
    weekKey:      prevKey,
    coinsAwarded: CHAMPION_COINS,
    newBadges,
    notification: `🎉 You finished top 1% last week! +${CHAMPION_COINS} 🪙 awarded!`,
  };
}

// ─── Hall of fame ─────────────────────────────────────────────────────────────

/** Returns champion lists for the last N completed weeks. */
export async function getHallOfFame(weeksBack = 4): Promise<Array<{ weekKey: string; champions: WeeklyChampion[] }>> {
  const monday = mondayOf(new Date());
  const results: Array<{ weekKey: string; champions: WeeklyChampion[] }> = [];

  for (let i = 1; i <= weeksBack; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() - i * 7);
    const weekKey = d.toISOString().split('T')[0];
    const snap = await getDoc(doc(db, 'weeklyChampions', weekKey));
    if (snap.exists() && snap.data().announced) {
      results.push({ weekKey, champions: snap.data().champions as WeeklyChampion[] });
    }
  }

  return results;
}

// ─── In-app notifications ─────────────────────────────────────────────────────

/** Returns contextual in-app notification strings for the current user. */
export async function getWeeklyNotifications(uid: string): Promise<string[]> {
  const msgs: string[] = [];
  try {
    const { rank, isTop1Percent, total } = await getPlayerWeeklyRank(uid, getCurrentWeekKey());
    if (rank === 0) return msgs;

    const msLeft = getWeekEndTime().getTime() - Date.now();
    const h24    = 24 * 60 * 60 * 1000;

    if (isTop1Percent && msLeft < h24) {
      msgs.push('⚡ Week ending in 24 hours — you\'re in the top 1%! Hold your rank!');
    } else if (!isTop1Percent && rank <= Math.ceil(total * 0.05)) {
      msgs.push(`🔥 You\'re rank #${rank} — push into the top 1% to win ${CHAMPION_COINS} coins!`);
    }
  } catch {}
  return msgs;
}
