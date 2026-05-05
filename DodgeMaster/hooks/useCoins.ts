import { useState, useEffect, useCallback } from 'react';
import { getCoins, addCoins, spendCoins, initCoins } from '@/services/coinService';
import { COIN_VALUES } from '@/constants/Coins';

export function useCoins() {
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);

  // On mount: run init (new-player bonus + daily login bonus), then load balance
  useEffect(() => {
    initCoins()
      .then((balance) => {
        setCoins(balance);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    const balance = await getCoins();
    setCoins(balance);
  }, []);

  const add = useCallback(async (amount: number): Promise<number> => {
    const balance = await addCoins(amount);
    setCoins(balance);
    return balance;
  }, []);

  const spend = useCallback(
    async (amount: number): Promise<boolean> => {
      const result = await spendCoins(amount);
      if (result.success) setCoins(result.balance);
      return result.success;
    },
    [],
  );

  const revive = useCallback(async (): Promise<boolean> => {
    return spend(COIN_VALUES.REVIVE_COST);
  }, [spend]);

  return { coins, loading, refresh, add, spend, revive };
}
