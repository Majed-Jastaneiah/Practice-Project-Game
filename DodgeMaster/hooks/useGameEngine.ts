import { useState, useEffect, useRef, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { GAME_CONFIG } from '@/constants/GameConfig';
import { Colors } from '@/constants/Colors';
import { circleCollision } from '@/utils/collision';
import { lerp, randomBetween, generateId } from '@/utils/helpers';
import type { ObstacleData, GamePhase } from '@/types';

interface UseGameEngineParams {
  playerX: SharedValue<number>;
  playerY: SharedValue<number>;
  screenWidth: number;
  screenHeight: number;
  /** Called once when the player first dies (not on revive). */
  onDeath: (finalScore: number) => void;
}

// ─── Obstacle factory ────────────────────────────────────────────────────────

function createObstacle(
  screenW: number,
  screenH: number,
  speed: number,
): ObstacleData {
  const edge = Math.floor(Math.random() * 4); // 0=top 1=right 2=bottom 3=left
  const radius = Math.round(
    randomBetween(GAME_CONFIG.OBSTACLE_MIN_RADIUS, GAME_CONFIG.OBSTACLE_MAX_RADIUS),
  );

  // Aim toward a random point in the inner 50% of the screen
  const targetX = screenW * (0.25 + Math.random() * 0.5);
  const targetY = screenH * (0.25 + Math.random() * 0.5);

  let x: number, y: number;
  switch (edge) {
    case 0:
      x = randomBetween(0, screenW);
      y = -radius;
      break;
    case 1:
      x = screenW + radius;
      y = randomBetween(0, screenH);
      break;
    case 2:
      x = randomBetween(0, screenW);
      y = screenH + radius;
      break;
    default:
      x = -radius;
      y = randomBetween(0, screenH);
  }

  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const color =
    Colors.obstacles[Math.floor(Math.random() * Colors.obstacles.length)];

  return {
    id: generateId(),
    x,
    y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    radius,
    color,
  };
}

function isOffScreen(
  obs: ObstacleData,
  screenW: number,
  screenH: number,
): boolean {
  const margin = obs.radius + 60;
  return (
    obs.x < -margin ||
    obs.x > screenW + margin ||
    obs.y < -margin ||
    obs.y > screenH + margin
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useGameEngine({
  playerX,
  playerY,
  screenWidth,
  screenHeight,
  onDeath,
}: UseGameEngineParams) {
  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('playing');

  // All mutable game state lives in refs to avoid stale closures and
  // to skip unnecessary React renders during the tight game loop.
  const phaseRef = useRef<GamePhase>('playing');
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const scoreRef = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpawnRef = useRef(Date.now());
  const startTimeRef = useRef(Date.now());
  const isInvincibleRef = useRef(false);
  const invincibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCalledDeathRef = useRef(false);

  // ── Tick ──
  // Defined as a ref so the interval always calls the latest closure without
  // being re-created (which would restart the interval) on every render.
  const tickRef = useRef<() => void>(() => {});

  tickRef.current = () => {
    if (phaseRef.current !== 'playing') return;

    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const difficulty = Math.min(
      elapsed / GAME_CONFIG.DIFFICULTY_RAMP_SECONDS,
      1,
    );
    const speed = lerp(
      GAME_CONFIG.OBSTACLE_SPEED_MIN,
      GAME_CONFIG.OBSTACLE_SPEED_MAX,
      difficulty,
    );
    const spawnInterval = lerp(
      GAME_CONFIG.SPAWN_INTERVAL_MAX_MS,
      GAME_CONFIG.SPAWN_INTERVAL_MIN_MS,
      difficulty,
    );

    // Spawn a new obstacle if the cooldown has elapsed
    if (
      obstaclesRef.current.length < GAME_CONFIG.MAX_OBSTACLES &&
      now - lastSpawnRef.current >= spawnInterval
    ) {
      lastSpawnRef.current = now;
      obstaclesRef.current = [
        ...obstaclesRef.current,
        createObstacle(screenWidth, screenHeight, speed),
      ];
    }

    // Move every obstacle and remove those that have left the screen
    obstaclesRef.current = obstaclesRef.current
      .map((obs) => ({ ...obs, x: obs.x + obs.vx, y: obs.y + obs.vy }))
      .filter((obs) => !isOffScreen(obs, screenWidth, screenHeight));

    // Accumulate score (seconds survived)
    scoreRef.current += GAME_CONFIG.TICK_RATE_MS / 1000;
    const roundedScore = Math.floor(scoreRef.current);

    // Collision check — skipped during post-revive invincibility window
    if (!isInvincibleRef.current) {
      const px = playerX.value;
      const py = playerY.value;

      for (const obs of obstaclesRef.current) {
        if (
          circleCollision(
            px,
            py,
            GAME_CONFIG.PLAYER_RADIUS,
            obs.x,
            obs.y,
            obs.radius,
          )
        ) {
          phaseRef.current = 'dead';
          setPhase('dead');
          setScore(roundedScore);
          setObstacles([...obstaclesRef.current]);

          if (!hasCalledDeathRef.current) {
            hasCalledDeathRef.current = true;
            onDeath(roundedScore);
          }

          if (loopRef.current) clearInterval(loopRef.current);
          loopRef.current = null;
          return;
        }
      }
    }

    // Sync to React for rendering
    setObstacles([...obstaclesRef.current]);
    setScore(roundedScore);
  };

  // Start the loop once on mount; cleanup on unmount
  useEffect(() => {
    loopRef.current = setInterval(
      () => tickRef.current(),
      GAME_CONFIG.TICK_RATE_MS,
    );
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
      if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public controls ──

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'paused';
    setPhase('paused');
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
  }, []);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    phaseRef.current = 'playing';
    setPhase('playing');
    loopRef.current = setInterval(
      () => tickRef.current(),
      GAME_CONFIG.TICK_RATE_MS,
    );
  }, []);

  const revivePlayer = useCallback(() => {
    // Clear any obstacles that are too close to the center (where player respawns)
    obstaclesRef.current = obstaclesRef.current.filter((obs) => {
      const dx = obs.x - screenWidth / 2;
      const dy = obs.y - screenHeight / 2;
      return Math.sqrt(dx * dx + dy * dy) > 130;
    });

    isInvincibleRef.current = true;
    phaseRef.current = 'playing';
    setPhase('playing');

    loopRef.current = setInterval(
      () => tickRef.current(),
      GAME_CONFIG.TICK_RATE_MS,
    );

    invincibleTimerRef.current = setTimeout(() => {
      isInvincibleRef.current = false;
    }, GAME_CONFIG.REVIVE_INVINCIBILITY_MS);
  }, [screenWidth, screenHeight]);

  return {
    obstacles,
    score,
    phase,
    pauseGame,
    resumeGame,
    revivePlayer,
  };
}
