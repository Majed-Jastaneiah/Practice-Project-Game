/**
 * useShareTrigger — monitors game events and decides when to prompt sharing.
 *
 * Triggers covered:
 *  1. New personal best score achieved
 *  2. Score milestone passed (30s, 1min, 2min, 5min)
 *  3. New rank unlocked
 *  4. Survived after revive
 *
 * Backend-only triggers (not yet implemented — require leaderboard/server data):
 *  • Weekly top 1% achieved
 *  • Weekly Champion reward received
 *  • King of Kings / Immortal / Dynasty status
 *  • Admin awarded star received
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { isNewRank, getRankForScore, SHARE_MILESTONES, type Rank } from '@/constants/Ranks';
import type { ShareCardVariant } from '@/components/share/ShareCard';

export interface ShareTriggerContext {
  variant: ShareCardVariant;
  score: number;
  rank: Rank;
  headline?: string;
  milestoneLabel?: string;
}

interface UseShareTriggerParams {
  score: number;
  bestScore: number;
  isNewBest: boolean;
  didRevive: boolean;
}

export function useShareTrigger({
  score,
  bestScore,
  isNewBest,
  didRevive,
}: UseShareTriggerParams) {
  const [shareContext, setShareContext] = useState<ShareTriggerContext | null>(null);
  const triggeredMilestonesRef = useRef(new Set<number>());
  const prevScoreRef = useRef(0);
  const hasTriggeredNewBestRef = useRef(false);
  const hasTriggeredReviveRef = useRef(false);

  const dismissShare = useCallback(() => setShareContext(null), []);

  useEffect(() => {
    if (score === 0) return;

    const currentRank = getRankForScore(score);
    const prevScore   = prevScoreRef.current;
    prevScoreRef.current = score;

    // 1. New personal best
    if (isNewBest && !hasTriggeredNewBestRef.current) {
      hasTriggeredNewBestRef.current = true;
      setShareContext({
        variant: 'score',
        score,
        rank: currentRank,
        headline: `NEW BEST!\n${score}s`,
      });
      return;
    }

    // 2. Rank unlocked
    if (isNewRank(prevScore, score)) {
      setShareContext({
        variant: 'rank',
        score,
        rank: currentRank,
      });
      return;
    }

    // 3. Milestone passed (30s, 60s, 120s, 300s)
    for (const milestone of SHARE_MILESTONES) {
      if (
        prevScore < milestone &&
        score >= milestone &&
        !triggeredMilestonesRef.current.has(milestone)
      ) {
        triggeredMilestonesRef.current.add(milestone);
        const mins = milestone >= 60 ? `${milestone / 60} minute${milestone >= 120 ? 's' : ''}` : `${milestone} seconds`;
        setShareContext({
          variant: 'milestone',
          score,
          rank: currentRank,
          milestoneLabel: `${mins.toUpperCase()} SURVIVED!`,
          headline: `${mins.toUpperCase()} SURVIVED!`,
        });
        return;
      }
    }
  }, [score, isNewBest]);

  // 4. Survived after revive
  useEffect(() => {
    if (didRevive && !hasTriggeredReviveRef.current && score > 0) {
      hasTriggeredReviveRef.current = true;
      setShareContext({
        variant: 'revive',
        score,
        rank: getRankForScore(score),
        headline: `BACK FROM THE DEAD!\n${score}s`,
      });
    }
  }, [didRevive, score]);

  return { shareContext, dismissShare };
}
