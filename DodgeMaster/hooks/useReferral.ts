import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  generateReferralCode,
  buildInviteLink,
  getReferralStats,
  recordInviteSent,
  type ReferralStats,
} from '@/services/referralService';

// Re-export type so callers only need one import
export type { ReferralStats } from '@/services/referralService';

export function useReferral() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);

  const referralCode = user ? generateReferralCode(user.uid) : null;
  const inviteLink   = referralCode ? buildInviteLink(referralCode) : null;

  useEffect(() => {
    if (user) {
      getReferralStats(user.uid).then(setStats);
    }
  }, [user]);

  const recordShare = useCallback(async () => {
    if (!user) return;
    await recordInviteSent(user.uid);
    const updated = await getReferralStats(user.uid);
    setStats(updated);
  }, [user]);

  return { referralCode, inviteLink, stats, recordShare };
}
