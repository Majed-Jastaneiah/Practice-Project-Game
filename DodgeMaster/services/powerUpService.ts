/**
 * Power-up inventory stored on the user's Firestore profile.
 * Uses merge writes into users/{uid} so it coexists with username/coins fields.
 *
 * Inventory shape (nested inside users/{uid}):
 *   powerUps: { timeCapsule: number, shield: number, ghost: number }
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type PowerUpKind = 'timeCapsule' | 'shield' | 'ghost';

export interface PowerUpInventory {
  timeCapsule: number;
  shield:      number;
  ghost:       number;
}

const EMPTY: PowerUpInventory = { timeCapsule: 0, shield: 0, ghost: 0 };

export const POWERUP_META: Record<PowerUpKind, { icon: string; label: string; description: string; durationMs: number }> = {
  timeCapsule: {
    icon:        '⏱️',
    label:       'Time Capsule',
    description: 'Slows everything to 20% speed for 10 seconds.',
    durationMs:  10_000,
  },
  shield: {
    icon:        '🛡️',
    label:       'Shield',
    description: 'Absorbs one fatal hit.',
    durationMs:  0, // until consumed
  },
  ghost: {
    icon:        '👻',
    label:       'Ghost Mode',
    description: 'Pass through all obstacles for 5 seconds.',
    durationMs:  5_000,
  },
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getInventory(uid: string): Promise<PowerUpInventory> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { ...EMPTY };
    const raw = snap.data().powerUps;
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    return {
      timeCapsule: raw.timeCapsule ?? 0,
      shield:      raw.shield      ?? 0,
      ghost:       raw.ghost       ?? 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────

async function writeInventory(uid: string, inv: PowerUpInventory): Promise<void> {
  await setDoc(doc(db, 'users', uid), { powerUps: inv }, { merge: true });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Add `count` of the given power-up to the player's inventory. */
export async function addPowerUp(
  uid: string,
  kind: PowerUpKind,
  count = 1,
): Promise<PowerUpInventory> {
  const inv = await getInventory(uid);
  const next = { ...inv, [kind]: inv[kind] + count };
  await writeInventory(uid, next);
  return next;
}

/**
 * Deduct one of the given power-up.
 * Returns `{ success, inventory }`.
 */
export async function usePowerUp(
  uid: string,
  kind: PowerUpKind,
): Promise<{ success: boolean; inventory: PowerUpInventory }> {
  const inv = await getInventory(uid);
  if (inv[kind] <= 0) return { success: false, inventory: inv };
  const next = { ...inv, [kind]: inv[kind] - 1 };
  await writeInventory(uid, next);
  return { success: true, inventory: next };
}
