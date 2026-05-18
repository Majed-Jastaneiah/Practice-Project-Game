import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import { Colors } from '@/constants/Colors';
import { useGameEngine } from '@/hooks/useGameEngine';
import type { SlicePoint, PowerUpType } from '@/hooks/useGameEngine';
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
        backgroundColor: 'rgba(255,255,255,0.9)',
        opacity,
        shadowColor:   '#FFFFFF',
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

const CHAOS_LABELS: Record<string, string> = {
  fire:    '🔥 FIRE CHAOS',
  ice:     '❄️ ICE CHAOS',
  thunder: '⚡ THUNDER CHAOS',
};

const MYSTERY_POOL: PowerUpType[] = ['kill_all', 'extra_points', 'slow_down', 'extra_lives'];

const MYSTERY_LABELS: Record<string, string> = {
  kill_all:     '💥 Kill All',
  extra_points: '⭐ Double Points',
  slow_down:    '🐢 Slow Down',
  extra_lives:  '❤️ Extra Lives',
};

function puEmoji(type: string): string {
  if (type === 'kill_all')     return '💥';
  if (type === 'extra_points') return '⭐';
  if (type === 'slow_down')    return '🐢';
  if (type === 'extra_lives')  return '❤️';
  if (type === 'mystery_box')  return '🎁';
  return '✨';
}

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
    chaosMode,
    survivalTime,
    powerUps,
    mysteryBoxCount,
    destroyShapeAt,
    destroyShapesAlongPath,
    pauseGame,
    resumeGame,
    revive,
    useMysteryBox,
  } = useGameEngine({ screenWidth, screenHeight, onDeath: handleDeath });

  // Keep scoreRef up to date for the quit handler
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Chaos announcement — visible for 3 s every time the mode changes
  const [showChaosAnnouncement, setShowChaosAnnouncement] = useState(false);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (chaosMode !== 'none') {
      setShowChaosAnnouncement(true);
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = setTimeout(() => setShowChaosAnnouncement(false), 3000);
    }
    return () => { if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current); };
  }, [chaosMode]);

  // Mystery box panel
  const [mysteryPanelOpen, setMysteryPanelOpen] = useState(false);
  const [mysteryChoices,   setMysteryChoices]   = useState<PowerUpType[]>([]);

  const openMysteryPanel = useCallback(() => {
    if (mysteryBoxCount <= 0) return;
    const choices = [...MYSTERY_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
    setMysteryChoices(choices);
    setMysteryPanelOpen(true);
  }, [mysteryBoxCount]);

  const handleMysteryChoice = useCallback((choice: PowerUpType) => {
    useMysteryBox(choice);
    setMysteryPanelOpen(false);
  }, [useMysteryBox]);

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

  const borderColor = chaosMode === 'fire'    ? '#FF4500'
                    : chaosMode === 'ice'     ? '#00E5FF'
                    : chaosMode === 'thunder' ? '#7C4DFF'
                    : 'rgba(255,255,255,0.35)';

  return (
    <View style={[styles.root, hitEffect && styles.rootHit, { borderWidth: 3, borderColor }]}>
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

          {/* Power-ups — glowing gold icons spawned from screen edges */}
          {powerUps.map(p => (
            <View
              key={p.id}
              pointerEvents="none"
              style={[styles.powerUpIcon, { left: p.x - 20, top: p.y - 20 }]}
            >
              <Text style={styles.powerUpEmoji}>{puEmoji(p.type)}</Text>
            </View>
          ))}

          {/* Fixed centre ball */}
          <PlayerDot x={centerX} y={centerY} hitEffect={hitEffect} />

          {/* HUD — above everything */}
          <GameHUD
            score={score}
            lives={lives}
            onPause={pauseGame}
            survivalTime={survivalTime}
            mysteryBoxCount={mysteryBoxCount}
            onMysteryBoxTap={openMysteryPanel}
          />

        </View>
      </GestureDetector>

      {/* Chaos mode announcement — centred, visible for 3 s each cycle */}
      {showChaosAnnouncement && chaosMode !== 'none' && (
        <View pointerEvents="none" style={styles.chaosOverlay}>
          <Text style={[styles.chaosText, { textShadowColor: borderColor }]}>
            {CHAOS_LABELS[chaosMode]}
          </Text>
        </View>
      )}

      {/* Dead overlay — offer revive before going to game over */}
      {phase === 'dead' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>YOU DIED</Text>
          <Text style={styles.overlayScore}>Score: {score}</Text>
          <View style={styles.overlayActions}>
            <Button label="❤️ REVIVE" onPress={revive}                      variant="primary" />
            <Button label="QUIT"       onPress={() => handleDeath(score)}    variant="ghost"   />
          </View>
        </View>
      )}

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

      {/* Mystery box choice panel */}
      {mysteryPanelOpen && (
        <View style={styles.mysteryOverlay}>
          <View style={styles.mysteryPanel}>
            <Text style={styles.mysteryTitle}>🎁 MYSTERY BOX</Text>
            <Text style={styles.mysterySubtitle}>Choose your reward:</Text>
            <View style={styles.mysteryChoices}>
              {mysteryChoices.map((choice) => (
                <TouchableOpacity
                  key={choice}
                  style={styles.mysteryChoiceBtn}
                  onPress={() => handleMysteryChoice(choice)}
                >
                  <Text style={styles.mysteryChoiceEmoji}>{puEmoji(choice)}</Text>
                  <Text style={styles.mysteryChoiceLabel}>{MYSTERY_LABELS[choice]}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
  overlayScore: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  overlayActions: {
    gap: 14,
    alignItems: 'center',
  },
  mysteryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryPanel: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24,
    shadowOpacity: 0.85,
    elevation: 30,
  },
  mysteryTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFD700',
    marginBottom: 4,
  },
  mysterySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 20,
  },
  mysteryChoices: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  mysteryChoiceBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  mysteryChoiceEmoji: {
    fontSize: 28,
  },
  mysteryChoiceLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  chaosOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaosText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  powerUpIcon: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    shadowOpacity: 1,
    elevation: 15,
  },
  powerUpEmoji: {
    fontSize: 18,
  },
});
