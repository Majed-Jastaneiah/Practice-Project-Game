/**
 * Daily challenges, streaks, and streak rewards.
 *
 * Firestore layout:
 *   dailyChallenges/{uid}  — challenge state, streaks, badge list
 *
 * NOTE: add this to firestore.rules.example:
 *   match /dailyChallenges/{userId} {
 *     allow read, write: if request.auth != null && request.auth.uid == userId;
 *   }
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { addCoins } from './coinService';
import { addPowerUp } from './powerUpService';

// ─── Challenge pool ───────────────────────────────────────────────────────────

export type ChallengeType =
  | 'play_3_games'
  | 'survive_60s'
  | 'survive_120s'
  | 'beat_personal_best'
  | 'survive_until_chaos'
  | 'survive_30s_after_chaos'
  | 'top_100_leaderboard';

export interface DailyChallenge {
  id: string;
  type: ChallengeType;
  label: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

const POOL: Array<Omit<DailyChallenge, 'id' | 'progress' | 'completed' | 'claimed'>> = [
  { type: 'play_3_games',             label: 'Hat Trick',              description: 'Play 3 games today',                         target: 3,   reward: 10  },
  { type: 'survive_60s',              label: 'Minute Man',             description: 'Survive 60 seconds in one game',             target: 60,  reward: 15  },
  { type: 'survive_120s',             label: 'Two-Minute Terror',      description: 'Survive 2 minutes in one game',              target: 120, reward: 25  },
  { type: 'beat_personal_best',       label: 'Beat Yourself',          description: 'Beat your personal best score',             target: 1,   reward: 20  },
  { type: 'survive_until_chaos',      label: 'Chaos Starter',          description: 'Survive until Chaos Mode kicks in (20 s)', target: 20,  reward: 30  },
  { type: 'survive_30s_after_chaos',  label: 'Chaos Survivor',         description: 'Survive 30 s after Chaos Mode activates', target: 50,  reward: 40  },
  { type: 'top_100_leaderboard',      label: 'Top 100',                description: 'Reach the top 100 global leaderboard',      target: 1,   reward: 50  },
];

const BONUS_ALL_3_REWARD = 30;

// ─── Streak milestones ────────────────────────────────────────────────────────

const LOGIN_STREAK_REWARDS: Record<number, { coins: number; badge?: string }> = {
  3:  { coins: 20 },
  7:  { coins: 50,  badge: '🥉 Bronze Streak' },
  30: { coins: 200, badge: '🥇 Gold Streak'   },
};

const CHALLENGE_STREAK_REWARDS: Record<number, { coins: number; badge?: string; timeCapsules?: number }> = {
  7:  { coins: 75,  badge: '🥈 Silver Streak', timeCapsules: 1 },
  30: { coins: 300, badge: '🏆 Legendary Streak', timeCapsules: 3 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toDateString();
}

function pick3(): DailyChallenge[] {
  const shuffled = [...POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((c, i) => ({
    ...c,
    id: `${c.type}_${i}`,
    progress: 0,
    completed: false,
    claimed:   false,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ChallengeDoc {
  date: string;
  challenges: DailyChallenge[];
  bonusClaimed: boolean;
  loginStreak: number;
  lastLoginDate: string;
  challengeStreak: number;
  lastAllCompleteDate: string;
  badges: string[];
}

const DEFAULT_DOC: ChallengeDoc = {
  date: '',
  challenges: [],
  bonusClaimed: false,
  loginStreak: 0,
  lastLoginDate: '',
  challengeStreak: 0,
  lastAllCompleteDate: '',
  badges: [],
};

async function loadDoc(uid: string): Promise<ChallengeDoc> {
  const snap = await getDoc(doc(db, 'dailyChallenges', uid));
  return snap.exists() ? (snap.data() as ChallengeDoc) : { ...DEFAULT_DOC };
}

/**
 * Fetch today's challenges. Generates a fresh set if the date has changed.
 * Also handles login streak on each call.
 */
export async function getDailyChallenges(uid: string): Promise<ChallengeDoc> {
  const today = todayStr();
  const data  = await loadDoc(uid);

  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const loginStreak =
    data.lastLoginDate === today     ? data.loginStreak :
    data.lastLoginDate === yesterday ? data.loginStreak + 1 : 1;

  const needNewChallenges = data.date !== today;
  const challengeStreak =
    needNewChallenges && data.lastAllCompleteDate === yesterday
      ? data.challengeStreak  // keep — will increment when all 3 are completed today
      : needNewChallenges
        ? 0                   // streak broken
        : data.challengeStreak;

  const updated: ChallengeDoc = {
    ...data,
    date:          needNewChallenges ? today       : data.date,
    challenges:    needNewChallenges ? pick3()     : data.challenges,
    bonusClaimed:  needNewChallenges ? false       : data.bonusClaimed,
    loginStreak,
    lastLoginDate: today,
    challengeStreak,
  };

  await setDoc(doc(db, 'dailyChallenges', uid), updated);

  // Award login streak rewards
  if (loginStreak !== data.loginStreak) {
    await _awardLoginStreakIfDue(uid, loginStreak, data.badges);
  }

  return updated;
}

/**
 * Update progress for one challenge type after a game session.
 * `value` is the raw metric (score in seconds, games count, etc.).
 * Returns the updated doc.
 */
export async function updateChallengeProgress(
  uid: string,
  type: ChallengeType,
  value: number,
): Promise<ChallengeDoc> {
  const data = await loadDoc(uid);
  if (data.date !== todayStr()) return data; // stale — call getDailyChallenges first

  let allDone = true;
  const challenges = data.challenges.map((c) => {
    if (c.type !== type || c.completed) {
      if (!c.completed) allDone = false;
      return c;
    }
    const progress  = Math.max(c.progress, value); // take highest
    const completed = progress >= c.target;
    if (!completed) allDone = false;
    return { ...c, progress, completed };
  });

  const updated: ChallengeDoc = { ...data, challenges };

  // If all 3 just completed, update challenge streak
  if (allDone && data.lastAllCompleteDate !== todayStr()) {
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const newStreak =
      data.lastAllCompleteDate === yesterday ? data.challengeStreak + 1 : 1;
    updated.challengeStreak    = newStreak;
    updated.lastAllCompleteDate = todayStr();
    await _awardChallengeStreakIfDue(uid, newStreak, data.badges);
  }

  await updateDoc(doc(db, 'dailyChallenges', uid), { challenges: updated.challenges, challengeStreak: updated.challengeStreak, lastAllCompleteDate: updated.lastAllCompleteDate });
  return updated;
}

/**
 * Claim the coin reward for a completed challenge.
 * The caller must pass the current user's uid.
 */
export async function claimChallengeReward(
  uid: string,
  challengeId: string,
): Promise<{ ok: boolean; coinsAwarded: number }> {
  const data = await loadDoc(uid);
  const ch   = data.challenges.find((c) => c.id === challengeId);
  if (!ch || !ch.completed || ch.claimed) return { ok: false, coinsAwarded: 0 };

  const challenges = data.challenges.map((c) =>
    c.id === challengeId ? { ...c, claimed: true } : c,
  );
  await addCoins(ch.reward);
  await updateDoc(doc(db, 'dailyChallenges', uid), { challenges });

  // Check if all 3 are now claimed → bonus
  const allClaimed = challenges.every((c) => c.claimed);
  if (allClaimed && !data.bonusClaimed) {
    await addCoins(BONUS_ALL_3_REWARD);
    await updateDoc(doc(db, 'dailyChallenges', uid), { bonusClaimed: true });
    return { ok: true, coinsAwarded: ch.reward + BONUS_ALL_3_REWARD };
  }

  return { ok: true, coinsAwarded: ch.reward };
}

// ─── Streak reward helpers ────────────────────────────────────────────────────

async function _awardLoginStreakIfDue(uid: string, streak: number, existingBadges: string[]) {
  const reward = LOGIN_STREAK_REWARDS[streak];
  if (!reward) return;
  await addCoins(reward.coins);
  if (reward.badge && !existingBadges.includes(reward.badge)) {
    await updateDoc(doc(db, 'dailyChallenges', uid), {
      badges: [...existingBadges, reward.badge],
    });
  }
}

async function _awardChallengeStreakIfDue(uid: string, streak: number, existingBadges: string[]) {
  const reward = CHALLENGE_STREAK_REWARDS[streak];
  if (!reward) return;
  await addCoins(reward.coins);
  if (reward.badge && !existingBadges.includes(reward.badge)) {
    await updateDoc(doc(db, 'dailyChallenges', uid), {
      badges: [...existingBadges, reward.badge],
    });
  }
  if (reward.timeCapsules) {
    await addPowerUp(uid, 'timeCapsule', reward.timeCapsules);
  }
}

export const BONUS_REWARD = BONUS_ALL_3_REWARD;
