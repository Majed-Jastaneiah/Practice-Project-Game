import { useState, useEffect, useRef, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { GAME_CONFIG } from '@/constants/GameConfig';
import { Colors } from '@/constants/Colors';
import { circleCollision } from '@/utils/collision';
import { lerp, randomBetween, generateId } from '@/utils/helpers';
import type { ObstacleData, GamePhase } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHAOS_TRIGGER_S  = 20;   // seconds until chaos erupts
const CHAOS_BURST_MS   = 2500; // duration of the initial flash/burst state
const POWERUP_CHANCE   = 0.002; // per-tick probability of a collectible spawning
const POWERUP_RADIUS   = 18;

// ─── Types ───────────────────────────────────────────────────────────────────

type ObstaclePattern =
  | 'drop'     // pre-chaos: straight down from top
  | 'straight' // aimed at centre from edge
  | 'sine'     // forward + perpendicular sine wobble
  | 'diagonal' // from corners
  | 'zigzag'   // periodic sharp lateral kicks
  | 'orbit'    // circular around a fixed point
  | 'bounce'   // bounces off screen walls
  | 'homing'   // gently steers toward player
  | 'spiral';  // shrinking orbit toward centre

interface EnhancedObstacle extends ObstacleData {
  pattern: ObstaclePattern;
  age: number;
  baseVx: number;
  baseVy: number;
  sinePhase: number;
  sineAmp: number;
  orbitCx: number; orbitCy: number;
  orbitR: number;  orbitAngle: number; orbitSpeed: number;
  zigzagTimer: number;
  spiralR: number; spiralAngle: number; spiralCx: number; spiralCy: number;
  glowing: boolean;
}

export type PowerUpDropKind = 'timeCapsule' | 'shield' | 'ghost';
export interface PowerUpDrop {
  id: string;
  x: number;
  y: number;
  kind: PowerUpDropKind;
}

interface UseGameEngineParams {
  playerX: SharedValue<number>;
  playerY: SharedValue<number>;
  screenWidth: number;
  screenHeight: number;
  onDeath: (finalScore: number) => void;
}

// ─── Obstacle factories ───────────────────────────────────────────────────────

function baseFields(
  id: string, x: number, y: number, vx: number, vy: number,
  radius: number, color: string, pattern: ObstaclePattern, glowing = false,
): EnhancedObstacle {
  return {
    id, x, y, vx, vy, radius, color, glowing,
    pattern, age: 0,
    baseVx: vx, baseVy: vy,
    sinePhase: Math.random() * Math.PI * 2, sineAmp: randomBetween(24, 56),
    orbitCx: 0, orbitCy: 0, orbitR: 100, orbitAngle: 0, orbitSpeed: 0.04,
    zigzagTimer: Math.floor(randomBetween(10, 22)),
    spiralR: 100, spiralAngle: 0, spiralCx: 0, spiralCy: 0,
  };
}

function randColor() {
  return Colors.obstacles[Math.floor(Math.random() * Colors.obstacles.length)];
}
function randRadius() {
  return Math.round(randomBetween(GAME_CONFIG.OBSTACLE_MIN_RADIUS, GAME_CONFIG.OBSTACLE_MAX_RADIUS));
}

// Pre-chaos: obstacles fall straight down from the top edge only.
function createDropObstacle(screenW: number, screenH: number, speed: number): EnhancedObstacle {
  const r = randRadius();
  const x = randomBetween(r, screenW - r);
  const o = baseFields(generateId(), x, -r, 0, speed, r, randColor(), 'drop');
  return { ...o, baseVx: 0, baseVy: speed };
}

// Post-chaos: one of 8 movement patterns chosen at random.
function createChaosObstacle(screenW: number, screenH: number, speed: number): EnhancedObstacle {
  const patterns: ObstaclePattern[] = [
    'straight', 'sine', 'diagonal', 'zigzag', 'orbit', 'bounce', 'homing', 'spiral',
  ];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const r = randRadius();
  const color = randColor();

  // Orbit and spiral spawn at the orbit position rather than an edge.
  if (pattern === 'orbit' || pattern === 'spiral') {
    const cx = screenW * randomBetween(0.25, 0.75);
    const cy = screenH * randomBetween(0.25, 0.75);
    const orbitR = randomBetween(60, 130);
    const angle = Math.random() * Math.PI * 2;
    const spd = randomBetween(0.025, 0.06) * (Math.random() > 0.5 ? 1 : -1);
    const x = cx + Math.cos(angle) * orbitR;
    const y = cy + Math.sin(angle) * orbitR;
    return {
      ...baseFields(generateId(), x, y, 0, 0, r, color, pattern, true),
      orbitCx: cx, orbitCy: cy, orbitR, orbitAngle: angle, orbitSpeed: spd,
      spiralR: orbitR, spiralAngle: angle, spiralCx: cx, spiralCy: cy,
    };
  }

  // Bounce spawns anywhere inside the screen.
  if (pattern === 'bounce') {
    const x = randomBetween(r, screenW - r);
    const y = randomBetween(r, screenH - r);
    const ang = Math.random() * Math.PI * 2;
    const vx = Math.cos(ang) * speed; const vy = Math.sin(ang) * speed;
    return { ...baseFields(generateId(), x, y, vx, vy, r, color, pattern, true), baseVx: vx, baseVy: vy };
  }

  // Diagonal from corners.
  if (pattern === 'diagonal') {
    const corner = Math.floor(Math.random() * 4);
    const x = corner % 2 === 0 ? -r : screenW + r;
    const y = corner < 2 ? -r : screenH + r;
    const tx = screenW * (0.3 + Math.random() * 0.4);
    const ty = screenH * (0.3 + Math.random() * 0.4);
    const dist = Math.sqrt((tx - x) ** 2 + (ty - y) ** 2) || 1;
    const vx = (tx - x) / dist * speed * 1.15;
    const vy = (ty - y) / dist * speed * 1.15;
    return { ...baseFields(generateId(), x, y, vx, vy, r, color, pattern, true), baseVx: vx, baseVy: vy };
  }

  // Edge spawn for straight / sine / zigzag / homing.
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number;
  switch (edge) {
    case 0:  x = randomBetween(0, screenW); y = -r; break;
    case 1:  x = screenW + r; y = randomBetween(0, screenH); break;
    case 2:  x = randomBetween(0, screenW); y = screenH + r; break;
    default: x = -r; y = randomBetween(0, screenH);
  }
  const tx = screenW * (0.25 + Math.random() * 0.5);
  const ty = screenH * (0.25 + Math.random() * 0.5);
  const dist = Math.sqrt((tx - x) ** 2 + (ty - y) ** 2) || 1;
  const vx = (tx - x) / dist * speed;
  const vy = (ty - y) / dist * speed;
  return { ...baseFields(generateId(), x, y, vx, vy, r, color, pattern, true), baseVx: vx, baseVy: vy };
}

// ─── Per-pattern movement ─────────────────────────────────────────────────────

function updateObstacle(
  obs: EnhancedObstacle,
  screenW: number,
  screenH: number,
  px: number,
  py: number,
  speed: number,
): EnhancedObstacle {
  const age = obs.age + 1;

  switch (obs.pattern) {
    case 'drop':
    case 'straight':
      return { ...obs, age, x: obs.x + obs.vx, y: obs.y + obs.vy };

    case 'sine': {
      const mag = Math.sqrt(obs.baseVx ** 2 + obs.baseVy ** 2) || 1;
      const perpX = -obs.baseVy / mag;
      const perpY =  obs.baseVx / mag;
      const wobble = Math.cos(age * 0.13 + obs.sinePhase) * obs.sineAmp * 0.13;
      return {
        ...obs, age,
        x: obs.x + obs.baseVx + perpX * wobble,
        y: obs.y + obs.baseVy + perpY * wobble,
      };
    }

    case 'diagonal':
      return { ...obs, age, x: obs.x + obs.vx, y: obs.y + obs.vy };

    case 'zigzag': {
      const timer = obs.zigzagTimer - 1;
      if (timer <= 0) {
        const mag = Math.sqrt(obs.baseVx ** 2 + obs.baseVy ** 2) || 1;
        const perpX = -obs.baseVy / mag;
        const perpY =  obs.baseVx / mag;
        const side  = age % 2 === 0 ? 1 : -1;
        const vx = obs.baseVx + perpX * mag * side * 1.6;
        const vy = obs.baseVy + perpY * mag * side * 1.6;
        return { ...obs, age, x: obs.x + vx, y: obs.y + vy, vx, vy, zigzagTimer: Math.floor(randomBetween(10, 24)) };
      }
      return { ...obs, age, x: obs.x + obs.vx, y: obs.y + obs.vy, zigzagTimer: timer };
    }

    case 'orbit': {
      const angle = obs.orbitAngle + obs.orbitSpeed;
      return {
        ...obs, age,
        x: obs.orbitCx + Math.cos(angle) * obs.orbitR,
        y: obs.orbitCy + Math.sin(angle) * obs.orbitR,
        orbitAngle: angle,
      };
    }

    case 'bounce': {
      let { x, y, vx, vy } = obs;
      x += vx; y += vy;
      if (x - obs.radius < 0 || x + obs.radius > screenW) { vx = -vx; x = Math.max(obs.radius, Math.min(x, screenW - obs.radius)); }
      if (y - obs.radius < 0 || y + obs.radius > screenH) { vy = -vy; y = Math.max(obs.radius, Math.min(y, screenH - obs.radius)); }
      return { ...obs, age, x, y, vx, vy };
    }

    case 'homing': {
      const dx = px - obs.x; const dy = py - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = 0.055 * speed;
      let vx = obs.vx * 0.96 + (dx / dist) * pull;
      let vy = obs.vy * 0.96 + (dy / dist) * pull;
      const vmag = Math.sqrt(vx * vx + vy * vy) || 1;
      const cap  = speed * 1.5;
      if (vmag > cap) { vx = vx / vmag * cap; vy = vy / vmag * cap; }
      return { ...obs, age, x: obs.x + vx, y: obs.y + vy, vx, vy };
    }

    case 'spiral': {
      const r     = obs.spiralR * 0.982;
      const angle = obs.spiralAngle + obs.orbitSpeed;
      const x = obs.spiralCx + Math.cos(angle) * r;
      const y = obs.spiralCy + Math.sin(angle) * r;
      if (r < 18) {
        // Re-expand at a new radius so it doesn't vanish
        return { ...obs, age, x, y, spiralR: randomBetween(90, 150), spiralAngle: Math.random() * Math.PI * 2 };
      }
      return { ...obs, age, x, y, spiralR: r, spiralAngle: angle };
    }

    default:
      return { ...obs, age, x: obs.x + obs.vx, y: obs.y + obs.vy };
  }
}

// ─── Off-screen test ──────────────────────────────────────────────────────────

function isOffScreen(obs: EnhancedObstacle, screenW: number, screenH: number): boolean {
  // Orbit, bounce, and spiral stay on-screen by design — use a large margin.
  const margin = (obs.pattern === 'orbit' || obs.pattern === 'bounce' || obs.pattern === 'spiral')
    ? 400
    : obs.radius + 80;
  return obs.x < -margin || obs.x > screenW + margin || obs.y < -margin || obs.y > screenH + margin;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameEngine({
  playerX,
  playerY,
  screenWidth,
  screenHeight,
  onDeath,
}: UseGameEngineParams) {
  const [obstacles,    setObstacles]    = useState<ObstacleData[]>([]);
  const [score,        setScore]        = useState(0);
  const [phase,        setPhase]        = useState<GamePhase>('playing');
  const [chaosMode,    setChaosMode]    = useState(false);
  const [chaosBurst,   setChaosBurst]   = useState(false);
  const [powerUpDrops, setPowerUpDrops] = useState<PowerUpDrop[]>([]);

  const phaseRef           = useRef<GamePhase>('playing');
  const obstaclesRef       = useRef<EnhancedObstacle[]>([]);
  const scoreRef           = useRef(0);
  const loopRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpawnRef       = useRef(Date.now());
  const startTimeRef       = useRef(Date.now());
  const isInvincibleRef    = useRef(false);
  const invincibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCalledDeathRef  = useRef(false);
  const chaosModeRef       = useRef(false);
  const chaosTriggeredRef  = useRef(false);
  const burstTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const powerUpDropsRef    = useRef<PowerUpDrop[]>([]);

  const tickRef = useRef<() => void>(() => {});

  tickRef.current = () => {
    if (phaseRef.current !== 'playing') return;

    const now     = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    // ── Chaos mode trigger at exactly 20 s ──
    if (!chaosTriggeredRef.current && elapsed >= CHAOS_TRIGGER_S) {
      chaosTriggeredRef.current = true;
      chaosModeRef.current = true;
      setChaosMode(true);
      setChaosBurst(true);
      // Mark all existing obstacles as glowing
      obstaclesRef.current = obstaclesRef.current.map((o) => ({ ...o, glowing: true }));
      burstTimerRef.current = setTimeout(() => setChaosBurst(false), CHAOS_BURST_MS);
    }

    const difficulty = Math.min(elapsed / GAME_CONFIG.DIFFICULTY_RAMP_SECONDS, 1);
    const speed = lerp(GAME_CONFIG.OBSTACLE_SPEED_MIN, GAME_CONFIG.OBSTACLE_SPEED_MAX, difficulty);
    const spawnInterval = lerp(GAME_CONFIG.SPAWN_INTERVAL_MAX_MS, GAME_CONFIG.SPAWN_INTERVAL_MIN_MS, difficulty);

    // ── Spawn ──
    if (
      obstaclesRef.current.length < GAME_CONFIG.MAX_OBSTACLES &&
      now - lastSpawnRef.current >= spawnInterval
    ) {
      lastSpawnRef.current = now;
      const newObs = chaosModeRef.current
        ? createChaosObstacle(screenWidth, screenHeight, speed)
        : createDropObstacle(screenWidth, screenHeight, speed);
      obstaclesRef.current = [...obstaclesRef.current, newObs];
    }

    // ── Move + cull ──
    const px = playerX.value;
    const py = playerY.value;

    obstaclesRef.current = obstaclesRef.current
      .map((obs) => updateObstacle(obs, screenWidth, screenHeight, px, py, speed))
      .filter((obs) => !isOffScreen(obs, screenWidth, screenHeight));

    // ── Power-up drop spawning ──
    if (chaosModeRef.current && Math.random() < POWERUP_CHANCE) {
      const kinds: PowerUpDropKind[] = ['timeCapsule', 'shield', 'ghost'];
      const drop: PowerUpDrop = {
        id:   generateId(),
        x:    randomBetween(POWERUP_RADIUS + 20, screenWidth  - POWERUP_RADIUS - 20),
        y:    randomBetween(POWERUP_RADIUS + 20, screenHeight - POWERUP_RADIUS - 20),
        kind: kinds[Math.floor(Math.random() * kinds.length)],
      };
      powerUpDropsRef.current = [...powerUpDropsRef.current, drop];
    }

    // Check if player collects any power-up drop
    const remainingDrops: PowerUpDrop[] = [];
    for (const drop of powerUpDropsRef.current) {
      const dx = px - drop.x; const dy = py - drop.y;
      if (dx * dx + dy * dy < (GAME_CONFIG.PLAYER_RADIUS + POWERUP_RADIUS) ** 2) {
        // Collected — caller should listen for length change and act
      } else {
        remainingDrops.push(drop);
      }
    }
    if (remainingDrops.length !== powerUpDropsRef.current.length) {
      powerUpDropsRef.current = remainingDrops;
      setPowerUpDrops([...remainingDrops]);
    }

    // ── Score ──
    scoreRef.current += GAME_CONFIG.TICK_RATE_MS / 1000;
    const roundedScore = Math.floor(scoreRef.current);

    // ── Collision ──
    if (!isInvincibleRef.current) {
      for (const obs of obstaclesRef.current) {
        if (circleCollision(px, py, GAME_CONFIG.PLAYER_RADIUS, obs.x, obs.y, obs.radius)) {
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

    setObstacles([...obstaclesRef.current]);
    setPowerUpDrops([...powerUpDropsRef.current]);
    setScore(roundedScore);
  };

  useEffect(() => {
    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
    return () => {
      if (loopRef.current)      clearInterval(loopRef.current);
      if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public controls ──────────────────────────────────────────────────────────

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
    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
  }, []);

  const revivePlayer = useCallback(() => {
    obstaclesRef.current = obstaclesRef.current.filter((obs) => {
      const dx = obs.x - screenWidth  / 2;
      const dy = obs.y - screenHeight / 2;
      return Math.sqrt(dx * dx + dy * dy) > 130;
    });

    isInvincibleRef.current = true;
    phaseRef.current = 'playing';
    setPhase('playing');

    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
    invincibleTimerRef.current = setTimeout(() => {
      isInvincibleRef.current = false;
    }, GAME_CONFIG.REVIVE_INVINCIBILITY_MS);
  }, [screenWidth, screenHeight]);

  // Called by the game screen when it visually handles a collected drop.
  const acknowledgeDropCollected = useCallback((id: string) => {
    powerUpDropsRef.current = powerUpDropsRef.current.filter((d) => d.id !== id);
    setPowerUpDrops([...powerUpDropsRef.current]);
  }, []);

  return {
    obstacles,
    score,
    phase,
    chaosMode,
    chaosBurst,   // true for ~2.5 s after chaos triggers — use for screen flash / shake
    powerUpDrops, // glowing collectibles on screen; game.tsx renders & calls acknowledgeDropCollected
    pauseGame,
    resumeGame,
    revivePlayer,
    acknowledgeDropCollected,
  };
}
