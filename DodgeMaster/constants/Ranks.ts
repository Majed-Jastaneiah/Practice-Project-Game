/**
 * Player rank thresholds (seconds survived).
 * Special ranks (King of Kings, Immortal, Dynasty) are awarded by the backend.
 */

export interface Rank {
  id: string;
  label: string;
  minScore: number;   // seconds required to reach this rank
  emoji: string;
  color: string;
}

export const RANKS: Rank[] = [
  { id: 'rookie',    label: 'Rookie',    minScore: 0,   emoji: '🥉', color: '#CD7F32' },
  { id: 'survivor',  label: 'Survivor',  minScore: 30,  emoji: '🥈', color: '#C0C0C0' },
  { id: 'veteran',   label: 'Veteran',   minScore: 60,  emoji: '🥇', color: '#FFD700' },
  { id: 'elite',     label: 'Elite',     minScore: 120, emoji: '💎', color: '#00BCD4' },
  { id: 'legend',    label: 'Legend',    minScore: 300, emoji: '👑', color: '#FF8C00' },
];

// Special server-assigned ranks — shown when returned by the backend
export const SPECIAL_RANKS = {
  KING_OF_KINGS: { id: 'king',      label: 'King of Kings',  emoji: '♛', color: '#FFD700' },
  IMMORTAL:      { id: 'immortal',  label: 'Immortal',       emoji: '⚡', color: '#E040FB' },
  DYNASTY:       { id: 'dynasty',   label: 'Dynasty',        emoji: '🏆', color: '#FF4081' },
};

/** Milestone scores (seconds) that unlock achievements and share prompts. */
export const SHARE_MILESTONES = [30, 60, 120, 300] as const;

/** Return the rank the player holds for a given best score. */
export function getRankForScore(score: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (score >= RANKS[i].minScore) return RANKS[i];
  }
  return RANKS[0];
}

/** True when the score exactly crosses a rank boundary (i.e. rank just changed). */
export function isNewRank(prevScore: number, newScore: number): boolean {
  return getRankForScore(prevScore).id !== getRankForScore(newScore).id;
}
