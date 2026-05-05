/**
 * Core sharing service.
 *
 * Handles platform-specific sharing via:
 *  • Native share sheet (all platforms — primary method)
 *  • WhatsApp (URL scheme)
 *  • Twitter / X (URL scheme / web intent)
 *  • Facebook (web sharer)
 *  • Instagram Stories (native share sheet with platform hint on iOS)
 *
 * Image sharing (share cards):
 *  • Cards are rendered off-screen using react-native-view-shot
 *  • The captured PNG is saved to a temp file then shared via expo-sharing
 *  • Note: react-native-view-shot requires an EAS build — it does not work in Expo Go.
 */

import { Share, Linking, Platform } from 'react-native';
import * as ExpoSharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export type SocialPlatform =
  | 'native'
  | 'whatsapp'
  | 'twitter'
  | 'facebook'
  | 'instagram';

interface ShareImageOptions {
  /** Base64 PNG string (no data: prefix) returned by react-native-view-shot */
  base64: string;
  message?: string;
}

interface ShareTextOptions {
  message: string;
  url?: string;
}

// ── Text sharing ─────────────────────────────────────────────────────────────

export async function shareText(
  opts: ShareTextOptions,
  platform: SocialPlatform = 'native',
): Promise<void> {
  const { message, url = '' } = opts;
  const combined = url ? `${message}\n${url}` : message;

  switch (platform) {
    case 'whatsapp': {
      const encoded = encodeURIComponent(combined);
      const whatsappUrl = `whatsapp://send?text=${encoded}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // WhatsApp not installed — fall back to native share sheet
        await Share.share({ message: combined });
      }
      break;
    }

    case 'twitter': {
      const encoded = encodeURIComponent(message);
      const urlEncoded = url ? `&url=${encodeURIComponent(url)}` : '';
      // Try app first, fall back to web
      const twitterAppUrl = `twitter://post?message=${encoded}`;
      const twitterWebUrl = `https://twitter.com/intent/tweet?text=${encoded}${urlEncoded}`;
      const canOpen = await Linking.canOpenURL(twitterAppUrl);
      await Linking.openURL(canOpen ? twitterAppUrl : twitterWebUrl);
      break;
    }

    case 'facebook': {
      // Facebook requires a URL to share (not raw text) via the web sharer
      const shareUrl = url || 'https://dodgemaster.app';
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`;
      await Linking.openURL(fbUrl);
      break;
    }

    case 'instagram':
    case 'native':
    default:
      await Share.share({ message: combined, url });
      break;
  }
}

// ── Image sharing ─────────────────────────────────────────────────────────────

/**
 * Share a base64 PNG image.
 * Writes the image to a temp file then uses expo-sharing for the native picker.
 *
 * NOTE: Requires EAS build (uses native modules not available in Expo Go).
 */
export async function shareImage(
  opts: ShareImageOptions,
  platform: SocialPlatform = 'native',
): Promise<void> {
  const { base64, message = '' } = opts;

  // Write base64 to a temporary file
  const tempUri = `${FileSystem.cacheDirectory}dodge_master_share_${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(tempUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await ExpoSharing.isAvailableAsync();
  if (!canShare) {
    // Fallback: share text only
    await Share.share({ message });
    return;
  }

  // Instagram Stories on iOS requires specific handling
  if (platform === 'instagram' && Platform.OS === 'ios') {
    const instagramUrl = 'instagram-stories://share';
    const canOpen = await Linking.canOpenURL(instagramUrl);
    if (canOpen) {
      // Instagram Stories deep link — image must be passed via pasteboard (native code)
      // TODO: implement via expo-modules native code for full Instagram Stories integration
      // For now fall through to native share sheet
    }
  }

  await ExpoSharing.shareAsync(tempUri, {
    mimeType: 'image/png',
    dialogTitle: message || 'Share your Dodge Master moment',
    UTI: 'public.png', // iOS only
  });
}

// ── Message templates ─────────────────────────────────────────────────────────

export const APP_STORE_URL = 'https://apps.apple.com/app/dodgemaster'; // TODO: fill in real ID
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dodgemaster'; // TODO

export function buildScoreMessage(score: number, playerName?: string): string {
  const name = playerName ? `${playerName} ` : '';
  return `🏆 ${name}just survived ${score} seconds in Dodge Master!\n\nThink you can beat it?`;
}

export function buildMilestoneMessage(seconds: number): string {
  const mins = seconds >= 60 ? `${Math.floor(seconds / 60)} minute${seconds >= 120 ? 's' : ''}` : `${seconds} seconds`;
  return `⚡ I survived ${mins} without getting hit in Dodge Master! Can you outlast me?`;
}

export function buildRankMessage(rankLabel: string): string {
  return `🎮 I just unlocked the "${rankLabel}" rank in Dodge Master! Come take me on!`;
}

export function buildReviveMessage(score: number): string {
  return `💀➡️🔥 I came back from death and survived ${score} seconds in Dodge Master!`;
}

export function buildInviteMessage(referralLink: string, score?: number): string {
  const scoreText = score ? ` My best is ${score} seconds.` : '';
  return `🕹️ I've been playing Dodge Master and I'm addicted!${scoreText} Download it and try to beat me:\n${referralLink}`;
}

export function buildProfileMessage(playerName: string, score: number, rankLabel: string): string {
  return `👤 ${playerName} | Rank: ${rankLabel} | Best: ${score}s\nPlay Dodge Master and challenge me!`;
}
