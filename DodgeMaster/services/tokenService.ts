/**
 * Secure token storage using expo-secure-store (hardware-backed on device).
 * Used for storing MFA secrets and other sensitive, non-Firebase credentials.
 * Firebase auth tokens are handled by Firebase's own persistence layer.
 */

import * as SecureStore from 'expo-secure-store';

const MFA_ENROLLED_KEY = 'dodgemaster:mfa_enrolled';
const MFA_FACTOR_UID_KEY = 'dodgemaster:mfa_factor_uid';

/** Returns true if the current user has enrolled MFA. */
export async function isMFAEnrolled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(MFA_ENROLLED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setMFAEnrolled(factorUid: string): Promise<void> {
  await SecureStore.setItemAsync(MFA_ENROLLED_KEY, 'true');
  await SecureStore.setItemAsync(MFA_FACTOR_UID_KEY, factorUid);
}

export async function getMFAFactorUid(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(MFA_FACTOR_UID_KEY);
  } catch {
    return null;
  }
}

export async function clearMFAData(): Promise<void> {
  await SecureStore.deleteItemAsync(MFA_ENROLLED_KEY);
  await SecureStore.deleteItemAsync(MFA_FACTOR_UID_KEY);
}

/** Generic helper: store any sensitive string value. */
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
