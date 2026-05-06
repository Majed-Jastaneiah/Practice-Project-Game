import { getItem, setItem } from '@/utils/storage';
import { COIN_VALUES } from '@/constants/Coins';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const COINS_KEY = 'dodgemaster:coins';
const LAST_LOGIN_KEY = 'dodgemaster:lastLogin';
const IS_NEW_PLAYER_KEY = 'dodgemaster:isNewPlayer';

// Fire-and-forget Firestore write — AsyncStorage is the source of truth for
// reads, Firestore provides cross-device/cross-install persistence.
function pushToFirestore(balance: number): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  setDoc(doc(db, 'users', uid), { coins: balance }, { merge: true }).catch(() => {});
}

export async function getCoins(): Promise<number> {
  return getItem<number>(COINS_KEY, 0);
}

export async function addCoins(amount: number): Promise<number> {
  const current = await getCoins();
  const next = current + amount;
  await setItem(COINS_KEY, next);
  pushToFirestore(next);
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
  pushToFirestore(next);
  return { success: true, balance: next };
}

/**
 * Called on every app launch.
 * Pulls the authoritative balance from Firestore first so cross-device
 * state is restored. Then grants new-player / daily-login bonuses.
 */
export async function initCoins(): Promise<number> {
  // Restore from Firestore (handles reinstall / new device)
  let hasCloudBalance = false;
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const cloudCoins = snap.data()?.coins;
      if (typeof cloudCoins === 'number') {
        await setItem(COINS_KEY, cloudCoins);
        hasCloudBalance = true;
      }
    } catch {}
  }

  const isNewPlayer = await getItem<boolean>(IS_NEW_PLAYER_KEY, true);

  if (isNewPlayer) {
    await setItem(IS_NEW_PLAYER_KEY, false);
    // Skip bonus if Firestore already has a balance — player played before
    if (!hasCloudBalance) {
      await addCoins(COIN_VALUES.NEW_PLAYER_BONUS);
    }
  }

  const lastLogin = await getItem<string>(LAST_LOGIN_KEY, '');
  const today = new Date().toDateString();

  if (lastLogin !== today) {
    await setItem(LAST_LOGIN_KEY, today);
    if (!isNewPlayer) {
      await addCoins(COIN_VALUES.DAILY_LOGIN_BONUS);
    }
  }

  return getCoins();
}
