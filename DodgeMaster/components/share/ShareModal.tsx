/**
 * ShareModal — bottom-sheet style modal with sharing options.
 *
 * Shows after a share trigger fires (new best, milestone, rank unlock, etc.).
 * Captures the ShareCard as a PNG then offers platform-specific share buttons.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Colors } from '@/constants/Colors';
import {
  shareImage,
  shareText,
  buildScoreMessage,
  type SocialPlatform,
} from '@/services/shareService';
import { ShareCard, type ShareCardVariant } from './ShareCard';
import type { Rank } from '@/constants/Ranks';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  variant: ShareCardVariant;
  score?: number;
  rank?: Rank;
  playerName?: string;
  milestoneLabel?: string;
  referralCode?: string;
  headline?: string;
}

const PLATFORMS: { id: SocialPlatform; label: string; icon: string }[] = [
  { id: 'native',    label: 'More…',     icon: '⬆️' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '📱' },
  { id: 'twitter',   label: 'X / Twitter', icon: '🐦' },
  { id: 'facebook',  label: 'Facebook',  icon: 'f' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
];

export function ShareModal({
  visible,
  onClose,
  variant,
  score = 0,
  rank,
  playerName,
  milestoneLabel,
  referralCode,
  headline,
}: ShareModalProps) {
  const cardRef = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = useCallback(
    async (platform: SocialPlatform) => {
      setCapturing(true);
      setError(null);
      try {
        // Try to capture the card as an image (requires EAS build)
        const base64 = await captureRef(cardRef, {
          format: 'png',
          quality: 1.0,
          result: 'base64',
        });
        await shareImage(
          {
            base64,
            message: buildScoreMessage(score, playerName),
          },
          platform,
        );
      } catch {
        // Fallback: text-only sharing (works in Expo Go and when view-shot unavailable)
        await shareText(
          { message: buildScoreMessage(score, playerName) },
          platform,
        );
      } finally {
        setCapturing(false);
        onClose();
      }
    },
    [score, playerName, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>

          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>Share Your Achievement</Text>

          {/* The card is rendered but initially hidden — captured when sharing */}
          <View style={styles.cardContainer} pointerEvents="none">
            <ShareCard
              ref={cardRef}
              variant={variant}
              score={score}
              rank={rank}
              playerName={playerName}
              milestoneLabel={milestoneLabel}
              referralCode={referralCode}
              headline={headline}
            />
          </View>

          {/* Share buttons */}
          {capturing ? (
            <ActivityIndicator color={Colors.gold} size="large" style={styles.loader} />
          ) : (
            <View style={styles.platforms}>
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.platformBtn}
                  onPress={() => handleShare(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.platformIcon}>{p.icon}</Text>
                  <Text style={styles.platformLabel}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundAlt,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
    marginBottom: 20,
    textAlign: 'center',
  },
  // Card is rendered off-screen (zero height) just so captureRef can access it
  cardContainer: {
    position: 'absolute',
    top: -2000,
    left: 0,
    overflow: 'hidden',
  },
  platforms: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  platformBtn: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  platformIcon: {
    fontSize: 28,
    lineHeight: 40,
    width: 52,
    height: 52,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  platformLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loader: { marginVertical: 32 },
  error: { color: Colors.danger, textAlign: 'center', fontSize: 12, marginBottom: 12 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
