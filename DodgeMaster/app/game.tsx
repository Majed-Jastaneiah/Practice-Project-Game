import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import { Colors } from '@/constants/Colors';
import { useGameEngine } from '@/hooks/useGameEngine';
import type { SlicePoint } from '@/hooks/useGameEngine';
import { useBestScore } from '@/hooks/useBestScore';
import { PlayerDot } from '@/components/PlayerDot';
import { ObstacleItem } from '@/components/ObstacleItem';
import { GameHUD } from '@/components/GameHUD';
import { Button } from '@/components/Button';

// ─── Slice trail segment (gold glowing bar between two points) ────────────────

function SliceSegment({
  p1, p2, opacity,
}: {
  p1: SlicePoint; p2: SlicePoint; opacity: number;
}) {
  const dx  = p2.x - p1.x;
  const dy  = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX  = (p1.x + p2.x) / 2;
  const midY  = (p1.y + p2.y) / 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left:        midX - len / 2,
        top:         midY - 3,
        width:       len,
        height:      6,
        borderRadius: 3,
        backgroundColor: '#FFD700',
        opacity,
        shadowColor:   '#FFD700',
        shadowOffset:  { width: 0, height: 0 },
        shadowRadius:  8,
        shadowOpacity: 0.95,
        elevation:     10,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Minimum finger travel before a press is treated as a swipe rather than a tap.
const SWIPE_THRESHOLD = 18;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GameScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { submitScore } = useBestScore();

  const [sliceTrail, setSliceTrail] = useState<SlicePoint[]>([]);
  const [isSlicing,  setIsSlicing]  = useState(false);

  const slicePointsRef = useRef<SlicePoint[]>([]);
  const trailTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef       = useRef(0); // mirror for stable handleQuit closure

  // ── Death callback ─────────────────────────────────────────────────────────

  const handleDeath = useCallback(
    (finalScore: number) => {
      submitScore(finalScore);
      router.replace({
        pathname: '/gameover',
        params: { score: String(finalScore), coinsEarned: '0' },
      });
    },
    [submitScore],
  );

  // ── Game engine ────────────────────────────────────────────────────────────

  const {
    shapes,
    score,
    lives,
    phase,
    hitEffect,
    centerX,
    centerY,
    destroyShapeAt,
    destroyShapesAlongPath,
    pauseGame,
    resumeGame,
  } = useGameEngine({ screenWidth, screenHeight, onDeath: handleDeath });

  // Keep scoreRef up to date for the quit handler
  useEffect(() => { scoreRef.current = score; }, [score]);

  // ── Quit to results ────────────────────────────────────────────────────────

  const handleQuit = useCallback(() => {
    router.replace({
      pathname: '/gameover',
      params: { score: String(scoreRef.current), coinsEarned: '0' },
    });
  }, []);

  // ── Gesture: single Pan handles both tap and swipe ─────────────────────────
  //
  //  • Move < SWIPE_THRESHOLD → treated as a tap on finalize → destroyShapeAt
  //  • Move ≥ SWIPE_THRESHOLD → swipe mode   → show trail, destroyShapesAlongPath
  //
  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      slicePointsRef.current = [{ x: e.x, y: e.y }];
      setSliceTrail([{ x: e.x, y: e.y }]);
      setIsSlicing(false);
    })
    .onUpdate((e) => {
      const pts   = slicePointsRef.current;
      const start = pts[0];
      if (!start) return;

      const moved = Math.sqrt((e.x - start.x) ** 2 + (e.y - start.y) ** 2);
      if (moved >= SWIPE_THRESHOLD) {
        const last = pts[pts.length - 1];
        const next = { x: e.x, y: e.y };
        // Destroy shapes only along the newest segment
        if (last) destroyShapesAlongPath([last, next]);
        const newPts = [...pts, next].slice(-50); // cap trail length
        slicePointsRef.current = newPts;
        setSliceTrail([...newPts]);
        if (!isSlicing) setIsSlicing(true);
      }
    })
    .onFinalize((e) => {
      const pts   = slicePointsRef.current;
      const start = pts[0];
      const moved = start
        ? Math.sqrt((e.x - start.x) ** 2 + (e.y - start.y) ** 2)
        : Infinity;

      if (moved < SWIPE_THRESHOLD) {
        // Short press — treat as tap on the start position
        if (start) destroyShapeAt(start.x, start.y);
      }

      setIsSlicing(false);
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      trailTimerRef.current = setTimeout(() => {
        setSliceTrail([]);
        slicePointsRef.current = [];
      }, 300);
    });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, hitEffect && styles.rootHit]}>
      <StatusBar hidden />

      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>

          {/* Incoming shapes */}
          {shapes.map((s) => (
            <ObstacleItem key={s.id} obstacle={s} />
          ))}

          {/* Slice trail — drawn ABOVE shapes */}
          {sliceTrail.length >= 2 &&
            sliceTrail.map((pt, i) =>
              i === 0 ? null : (
                <SliceSegment
                  key={i}
                  p1={sliceTrail[i - 1]}
                  p2={pt}
                  opacity={isSlicing ? 0.92 : 0.45}
                />
              ),
            )}

          {/* Fixed centre ball */}
          <PlayerDot x={centerX} y={centerY} hitEffect={hitEffect} />

          {/* HUD — above everything */}
          <GameHUD score={score} lives={lives} onPause={pauseGame} />

        </View>
      </GestureDetector>

      {/* Pause overlay */}
      {phase === 'paused' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>PAUSED</Text>
          <View style={styles.overlayActions}>
            <Button label="RESUME" onPress={resumeGame} variant="primary" />
            <Button label="QUIT"   onPress={handleQuit} variant="ghost"   />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootHit: {
    // Subtle red tint when a shape reaches the centre ball
    backgroundColor: '#130000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  overlayTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  overlayActions: {
    gap: 14,
    alignItems: 'center',
  },
});
