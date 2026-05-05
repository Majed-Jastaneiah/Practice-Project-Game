/**
 * Referral system — tracks who invited who and manages referral rewards.
 *
 * Architecture:
 *  • Each user has a unique referral code (first 8 chars of Firebase UID).
 *  • Sharing generates a deep link: dodgemaster://invite?ref=CODE
 *    (or a web URL for non-app users, configured when Firebase Dynamic Links is set up).
 *  • When a new user opens the app via that link, the code is stored locally
 *    via `storePendingReferral()` before they register.
 *  • After registration, `redeemReferral()` credits both parties.
 *
 * TODO (requires backend):
 *  1. Replace `addCoins()` calls with a Firebase Cloud Function so coin grants
 *     cannot be spoofed client-side.
 *  2. Store referral records in Firestore (inviter → invited mapping).
 *  3. Validate each referral code against Firestore before crediting.
 *  4. Prevent double-redemption server-side.
 */

import { getItem, setItem } from '@/utils/storage';
import { addCoins } from '@/services/coinService';
import { COIN_VALUES } from '@/constants/Coins';

// Additional coin bonus constants (keep out of hardcode)
const REFERRAL_INVITER_BONUS = 50;  // coins awarded to the person who shared
const REFERRAL_INVITEE_BONUS = 10;  // extra coins on top of new-player bonus

const PENDING_REFERRAL_KEY = 'dodgemaster:pendingReferral';
const REFERRAL_REDEEMED_KEY = 'dodgemaster:referralRedeemed';
const REFERRAL_STATS_KEY = 'dodgemaster:referralStats';

interface ReferralStats {
  code: string;
  invitesSent: number;
  invitesConverted: number;
  coinsEarnedFromReferrals: number;
}

/** Generate the referral code for the current user (Firebase UID). */
export function generateReferralCode(uid: string): string {
  // Use the first 8 characters of the UID, uppercased
  return uid.slice(0, 8).toUpperCase();
}

/** Build a shareable invite deep link. */
export function buildInviteLink(referralCode: string): string {
  // TODO: Replace with Firebase Dynamic Links or Branch.io URL when configured.
  // Dynamic links allow non-app-users to be routed to the App Store/Play Store
  // and have the referral code preserved through install.
  return `https://dodgemaster.app/invite?ref=${referralCode}`;
}

/** Called when the app is opened via a referral deep link (before sign-in). */
export async function storePendingReferral(referralCode: string): Promise<void> {
  const alreadyRedeemed = await getItem<boolean>(REFERRAL_REDEEMED_KEY, false);
  if (!alreadyRedeemed) {
    await setItem(PENDING_REFERRAL_KEY, referralCode);
  }
}

/** Called after the new user completes registration. Grants both parties coins. */
export async function redeemReferral(): Promise<{ coinsGranted: number } | null> {
  const alreadyRedeemed = await getItem<boolean>(REFERRAL_REDEEMED_KEY, false);
  if (alreadyRedeemed) return null;

  const pendingCode = await getItem<string | null>(PENDING_REFERRAL_KEY, null);
  if (!pendingCode) return null;

  // Mark as redeemed to prevent double-dipping
  await setItem(REFERRAL_REDEEMED_KEY, true);

  // Award the new user bonus coins
  await addCoins(REFERRAL_INVITEE_BONUS);

  // TODO: Trigger a Cloud Function here to credit the inviter (pendingCode)
  //       with REFERRAL_INVITER_BONUS coins, validated server-side.
  //       Example: await firebase.functions().httpsCallable('creditReferrer')({ code: pendingCode });

  return { coinsGranted: REFERRAL_INVITEE_BONUS };
}

export async function getReferralStats(uid: string): Promise<ReferralStats> {
  const code = generateReferralCode(uid);
  const stats = await getItem<Omit<ReferralStats, 'code'>>(REFERRAL_STATS_KEY, {
    invitesSent: 0,
    invitesConverted: 0,
    coinsEarnedFromReferrals: 0,
  });
  return { code, ...stats };
}

export async function recordInviteSent(uid: string): Promise<void> {
  const stats = await getReferralStats(uid);
  await setItem(REFERRAL_STATS_KEY, {
    invitesSent: stats.invitesSent + 1,
    invitesConverted: stats.invitesConverted,
    coinsEarnedFromReferrals: stats.coinsEarnedFromReferrals,
  });
}
