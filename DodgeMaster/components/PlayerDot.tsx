import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { CENTER_BALL_RADIUS as R } from '@/hooks/useGameEngine';

// ─── Centre ball ──────────────────────────────────────────────────────────────
//
// Fixed at (x, y) — the absolute screen centre. Never moves.
// Three concentric layers: outer halo, mid glow ring, solid core.
// hitEffect flashes everything red when a shape reaches the ball.

interface Props {
  x: number;
  y: number;
  hitEffect: boolean;
}

export function PlayerDot({ x, y, hitEffect }: Props) {
  const coreColor  = hitEffect ? '#FF1C1C' : Colors.gold;
  const glowColor  = hitEffect ? '#FF0000' : '#FF8C00'; // red on hit, orange normally
  const midGlow    = hitEffect ? 'rgba(255,0,0,0.32)'   : 'rgba(255,140,0,0.24)';
  const outerGlow  = hitEffect ? 'rgba(255,0,0,0.11)'   : Colors.goldGlow;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrapper, { left: x - R * 2.8, top: y - R * 2.8 }]}
    >
      {/* Outermost ambient halo */}
      <View style={[styles.ring, styles.outer, { backgroundColor: outerGlow }]} />
      {/* Mid glow ring */}
      <View style={[styles.ring, styles.mid,   { backgroundColor: midGlow   }]} />
      {/* Solid core */}
      <View
        style={[
          styles.core,
          {
            backgroundColor: coreColor,
            shadowColor:      glowColor,
            shadowRadius:     hitEffect ? 22 : 15,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width:    R * 5.6,
    height:   R * 5.6,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
  },
  outer: {
    width:  R * 5.6,
    height: R * 5.6,
  },
  mid: {
    width:  R * 3.6,
    height: R * 3.6,
  },
  core: {
    width:         R * 2,
    height:        R * 2,
    borderRadius:  R,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 1,
    elevation:     24,
  },
});
