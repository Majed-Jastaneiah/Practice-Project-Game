/**
 * Secure local storage for sensitive values that must survive app restarts.
 * Uses expo-secure-store (hardware-backed keychain/keystore on device).
 *
 * Only the MFA-enrolled flag is stored here. OTP codes live in Firestore
 * (server-side) so they can be invalidated remotely and survive re-installs.
 */

import * as SecureStore from 'expo-secure-store';

const MFA_ENROLLED_KEY = 'dodgemaster:mfa_enrolled';

/** Returns true if this device has email MFA enrolled for the current user. */
export async function isMFAEnrolled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(MFA_ENROLLED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setMFAEnrolled(): Promise<void> {
  await SecureStore.setItemAsync(MFA_ENROLLED_KEY, 'true');
}

export async function clearMFAEnrolled(): Promise<void> {
  await SecureStore.deleteItemAsync(MFA_ENROLLED_KEY);
}

/** Generic helpers for any other sensitive values. */
export async function storeSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(`dodgemaster:${key}`, value);
}

export async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`dodgemaster:${key}`);
  } catch {
    return null;
  }
}

export async function deleteSecure(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(`dodgemaster:${key}`);
}
