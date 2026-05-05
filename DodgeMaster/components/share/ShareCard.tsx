/**
 * ShareCard — the visual card that gets captured as an image and shared.
 *
 * Cards are rendered off-screen at a fixed 375×667 size for consistent output,
 * then captured via react-native-view-shot in the parent component.
 *
 * Usage:
 *   const cardRef = useRef<View>(null);
 *   <ShareCard ref={cardRef} variant="score" score={142} rank={rank} />
 *   // capture:
 *   const uri = await captureRef(cardRef, { format: 'png', quality: 1.0 });
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/Colors';
import { getRankForScore, type Rank } from '@/constants/Ranks';
import { APP_STORE_URL } from '@/services/shareService';

export type ShareCardVariant =
  | 'score'
  | 'milestone'
  | 'rank'
  | 'revive'
  | 'invite'
  | 'profile';

interface ShareCardProps {
  variant: ShareCardVariant;
  score?: number;
  rank?: Rank;
  playerName?: string;
  milestoneLabel?: string;
  referralCode?: string;
  /** Extra headline override */
  headline?: string;
}

const CARD_W = 375;
const CARD_H = 667;

// A row of gold shimmer accent bars across the top and bottom
function GoldShimmer() {
  return (
    <View style={shimmer.container}>
      {[...Array(5)].map((_, i) => (
        <View
          key={i}
          style={[shimmer.bar, { opacity: 0.15 + i * 0.07, width: 30 + i * 18 }]}
        />
      ))}
    </View>
  );
}

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { variant, score = 0, playerName, milestoneLabel, referralCode, headline, rank },
  ref,
) {
  const resolvedRank = rank ?? getRankForScore(score);
  const qrValue = referralCode
    ? `https://dodgemaster.app/invite?ref=${referralCode}`
    : APP_STORE_URL;

  const mainText = headline ?? resolveHeadline(variant, score, resolvedRank, milestoneLabel);
  const subText = resolveSubtext(variant, score, playerName, referralCode);

  return (
    <View ref={ref} style={card.root} collapsable={false}>
      {/* Background gold grid lines */}
      <View style={card.gridH} />
      <View style={card.gridV} />

      {/* Top shimmer */}
      <GoldShimmer />

      {/* Brand */}
      <View style={card.brandRow}>
        <View style={card.dotIcon} />
        <Text style={card.brand}>DODGE MASTER</Text>
      </View>

      {/* Main content */}
      <View style={card.body}>
        {playerName ? (
          <Text style={card.playerName}>{playerName}</Text>
        ) : null}

        <Text style={card.rankBadge}>
          {resolvedRank.emoji}  {resolvedRank.label.toUpperCase()}
        </Text>

        <Text style={card.headline}>{mainText}</Text>

        {subText ? <Text style={card.subtext}>{subText}</Text> : null}
      </View>

      {/* QR + download */}
      <View style={card.footer}>
        <View style={card.qrContainer}>
          <QRCode
            value={qrValue}
            size={84}
            backgroundColor="transparent"
            color={Colors.gold}
          />
          <Text style={card.qrLabel}>SCAN TO PLAY</Text>
        </View>
        <View style={card.downloadLinks}>
          <Text style={card.dlText}>🍎  App Store</Text>
          <Text style={card.dlText}>🤖  Google Play</Text>
          <Text style={card.dlUrl}>dodgemaster.app</Text>
        </View>
      </View>

      {/* Bottom shimmer */}
      <GoldShimmer />
    </View>
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveHeadline(
  variant: ShareCardVariant,
  score: number,
  rank: Rank,
  milestoneLabel?: string,
): string {
  switch (variant) {
    case 'score':     return `${score}s SURVIVED`;
    case 'milestone': return milestoneLabel ?? `${score}s SURVIVED`;
    case 'rank':      return `${rank.emoji} ${rank.label.toUpperCase()} UNLOCKED`;
    case 'revive':    return `CAME BACK FROM THE DEAD!\n${score}s SURVIVED`;
    case 'invite':    return 'COME BEAT MY SCORE!';
    case 'profile':   return `${rank.emoji} ${rank.label.toUpperCase()}`;
    default:          return `${score}s`;
  }
}

function resolveSubtext(
  variant: ShareCardVariant,
  score: number,
  playerName?: string,
  referralCode?: string,
): string {
  switch (variant) {
    case 'invite':
      return referralCode
        ? `Use code ${referralCode} for 10 bonus coins`
        : 'Download and dodge everything!';
    case 'profile':
      return `Best: ${score}s`;
    default:
      return 'Can you survive longer?';
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────

const card = StyleSheet.create({
  root: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#05050F',
    borderWidth: 1.5,
    borderColor: Colors.gold,
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 28,
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CARD_H / 2,
    height: 1,
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: CARD_W / 2,
    width: 1,
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  brand: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 4,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
  },
  playerName: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  rankBadge: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 3,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    overflow: 'hidden',
  },
  headline: {
    fontSize: 52,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 58,
    letterSpacing: 1,
  },
  subtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,215,0,0.2)',
    paddingTop: 16,
  },
  qrContainer: {
    alignItems: 'center',
    gap: 6,
  },
  qrLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  downloadLinks: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dlText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dlUrl: {
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 1,
    marginTop: 4,
  },
});

const shimmer = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  bar: {
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
});
