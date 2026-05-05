import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { GAME_CONFIG } from '@/constants/GameConfig';
import { Colors } from '@/constants/Colors';

interface PlayerDotProps {
  animatedStyle: object;
  isInvincible?: boolean;
}

const R = GAME_CONFIG.PLAYER_RADIUS;

export function PlayerDot({ animatedStyle, isInvincible = false }: PlayerDotProps) {
  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      {/* Layered glow rings — pure shadow trickery, no external lib needed */}
      <View
        style={[
          styles.outerGlow,
          isInvincible && styles.invincibleGlow,
        ]}
      />
      <View style={styles.innerGlow} />
      <View style={[styles.core, isInvincible && styles.invincibleCore]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: R * 2,
    height: R * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    width: R * 3.6,
    height: R * 3.6,
    borderRadius: R * 1.8,
    backgroundColor: Colors.goldGlow,
  },
  innerGlow: {
    position: 'absolute',
    width: R * 2.4,
    height: R * 2.4,
    borderRadius: R * 1.2,
    backgroundColor: 'rgba(255, 215, 0, 0.45)',
  },
  core: {
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },
  invincibleGlow: {
    backgroundColor: 'rgba(100, 200, 255, 0.3)',
  },
  invincibleCore: {
    backgroundColor: '#64C8FF',
    shadowColor: '#64C8FF',
  },
});
