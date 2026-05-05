import { getItem, setItem } from '@/utils/storage';
import { COIN_VALUES } from '@/constants/Coins';

const COINS_KEY = 'dodgemaster:coins';
const LAST_LOGIN_KEY = 'dodgemaster:lastLogin';
const IS_NEW_PLAYER_KEY = 'dodgemaster:isNewPlayer';

export async function getCoins(): Promise<number> {
  return getItem<number>(COINS_KEY, 0);
}

export async function addCoins(amount: number): Promise<number> {
  const current = await getCoins();
  const next = current + amount;
  await setItem(COINS_KEY, next);
  return next;
}

/**
 * Attempt to deduct `amount` from the balance.
 * Returns { success: true, balance } on success, or { success: false, balance } if insufficient.
 */
export async function spendCoins(
  amount: number,
): Promise<{ success: boolean; balance: number }> {
  const current = await getCoins();
  if (current < amount) return { success: false, balance: current };
  const next = current - amount;
  await setItem(COINS_KEY, next);
  return { success: true, balance: next };
}

/**
 * Called on every app launch.
 * Grants the new-player bonus on first run, and the daily login bonus once per calendar day.
 * Returns the final coin balance.
 */
export async function initCoins(): Promise<number> {
  const isNewPlayer = await getItem<boolean>(IS_NEW_PLAYER_KEY, true);

  if (isNewPlayer) {
    await setItem(IS_NEW_PLAYER_KEY, false);
    await addCoins(COIN_VALUES.NEW_PLAYER_BONUS);
  }

  const lastLogin = await getItem<string>(LAST_LOGIN_KEY, '');
  const today = new Date().toDateString();

  if (lastLogin !== today) {
    await setItem(LAST_LOGIN_KEY, today);
    // Skip daily bonus on the very first launch (new-player bonus covers it)
    if (!isNewPlayer) {
      await addCoins(COIN_VALUES.DAILY_LOGIN_BONUS);
    }
  }

  return getCoins();
}
