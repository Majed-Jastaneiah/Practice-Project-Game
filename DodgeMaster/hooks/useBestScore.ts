import { useState, useEffect, useCallback } from 'react';
import { getItem, setItem } from '@/utils/storage';

const BEST_SCORE_KEY = 'dodgemaster:bestScore';

export function useBestScore() {
  const [bestScore, setBestScore] = useState(0);

  useEffect(() => {
    getItem<number>(BEST_SCORE_KEY, 0).then(setBestScore);
  }, []);

  /**
   * Submit a final score. If it beats the stored best, persist and return true.
   */
  const submitScore = useCallback(async (score: number): Promise<boolean> => {
    const current = await getItem<number>(BEST_SCORE_KEY, 0);
    if (score > current) {
      await setItem(BEST_SCORE_KEY, score);
      setBestScore(score);
      return true;
    }
    return false;
  }, []);

  return { bestScore, submitScore };
}
