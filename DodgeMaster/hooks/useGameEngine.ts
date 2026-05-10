import { useState, useEffect, useRef, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { GAME_CONFIG } from '@/constants/GameConfig';
import { Colors } from '@/constants/Colors';
import { circleCollision } from '@/utils/collision';
import { lerp, randomBetween, generateId } from '@/utils/helpers';
import type { ObstacleData, GamePhase } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const WAVE_DURATION_S = 20;   // each calm / chaos phase lasts 20 s
const CHAOS_BURST_MS  = 2500; // screen-flash duration at chaos wave start
const PHASE_TEXT_MS   = 3000; // how long "CHAOS MODE" / "CALM…" text stays up
const POWERUP_CHANCE  = 0.002;
const POWERUP_RADIUS  = 18;

// ─── Types ───────────────────────────────────────────────────────────────────

type ObstaclePattern =
  | 'drop'
  | 'straight'
  | 'sine'
  | 'diagonal'
  | 'zigzag'
  | 'orbit'
  | 'bounce'
  | 'homing'
  | 'spiral';

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

// ─── Wave speed system ────────────────────────────────────────────────────────
//
// Waves alternate: 0=calm, 1=chaos, 2=calm, 3=chaos, …
//
// Calm multiplier : 1.0 + calmWaveNum  * 0.20  (+5 % per 5 s step inside wave)
// Chaos multiplier: 1.5 + (chaosNum-1) * 0.20  (+10% per 5 s step inside wave)

interface WaveState {
  waveIndex: number;
  isChaosWave: boolean;
  calmWaveNum: number;  // 0, 1, 2… — which calm period we're in
  speed: number;
}

function getWaveState(elapsed: number): WaveState {
  const waveIndex    = Math.floor(elapsed / WAVE_DURATION_S);
  const isChaosWave  = waveIndex % 2 === 1;
  const timeInWave   = elapsed % WAVE_DURATION_S;
  const stepsInWave  = Math.floor(timeInWave / 5); // 0-3

  const chaosWaveNum = Math.ceil(waveIndex / 2);   // 1, 2, 3… for chaos waves
  const calmWaveNum  = Math.floor(waveIndex / 2);  // 0, 1, 2… for calm waves

  let multiplier: number;
  if (isChaosWave) {
    multiplier = 1.5 + (chaosWaveNum - 1) * 0.2 + stepsInWave * 0.10;
  } else {
    multiplier = 1.0 + calmWaveNum * 0.2 + stepsInWave * 0.05;
  }

  const speed = Math.min(
    GAME_CONFIG.OBSTACLE_SPEED_MIN * multiplier,
    GAME_CONFIG.OBSTACLE_SPEED_MAX,
  );

  return { waveIndex, isChaosWave, calmWaveNum, speed };
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

// Calm primary: straight from any of the 4 edges.
function createDropObstacle(screenW: number, screenH: number, speed: number): EnhancedObstacle {
  const r    = randRadius();
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number, vx: number, vy: number;
  switch (edge) {
    case 0:  x = randomBetween(r, screenW - r); y = -r;           vx = 0;       vy = speed;  break; // top → down
    case 1:  x = randomBetween(r, screenW - r); y = screenH + r;  vx = 0;       vy = -speed; break; // bottom → up
    case 2:  x = -r;           y = randomBetween(r, screenH - r); vx = speed;   vy = 0;      break; // left → right
    default: x = screenW + r;  y = randomBetween(r, screenH - r); vx = -speed;  vy = 0;             // right → left
  }
  const o = baseFields(generateId(), x, y, vx, vy, r, randColor(), 'drop');
  return { ...o, baseVx: vx, baseVy: vy };
}

// Calm secondary (wave 2+): edge-spawn aimed at a central target with sine wobble.
function createSineObstacle(screenW: number, screenH: number, speed: number): EnhancedObstacle {
  const r    = randRadius();
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number;
  switch (edge) {
    case 0:  x = randomBetween(r, screenW - r); y = -r;           break;
    case 1:  x = screenW + r; y = randomBetween(r, screenH - r);  break;
    case 2:  x = randomBetween(r, screenW - r); y = screenH + r;  break;
    default: x = -r;          y = randomBetween(r, screenH - r);
  }
  const tx   = screenW * (0.3 + Math.random() * 0.4);
  const ty   = screenH * (0.3 + Math.random() * 0.4);
  const dist = Math.sqrt((tx - x) ** 2 + (ty - y) ** 2) || 1;
  const vx   = (tx - x) / dist * speed;
  const vy   = (ty - y) / dist * speed;
  return { ...baseFields(generateId(), x, y, vx, vy, r, randColor(), 'sine'), baseVx: vx, baseVy: vy };
}

// Calm dispatcher: wave 0 = straight only; wave 1+ = 35% chance of sine.
function createCalmObstacle(
  screenW: number, screenH: number, speed: number, calmWaveNum: number,
): EnhancedObstacle {
  if (calmWaveNum >= 1 && Math.random() < 0.35) {
    return createSineObstacle(screenW, screenH, speed);
  }
  return createDropObstacle(screenW, screenH, speed);
}

// Chaos: one of 8 patterns at random.
function createChaosObstacle(screenW: number, screenH: number, speed: number): EnhancedObstacle {
  const patterns: ObstaclePattern[] = [
    'straight', 'sine', 'diagonal', 'zigzag', 'orbit', 'bounce', 'homing', 'spiral',
  ];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const r       = randRadius();
  const color   = randColor();

  if (pattern === 'orbit' || pattern === 'spiral') {
    const cx     = screenW * randomBetween(0.25, 0.75);
    const cy     = screenH * randomBetween(0.25, 0.75);
    const orbitR = randomBetween(60, 130);
    const angle  = Math.random() * Math.PI * 2;
    const spd    = randomBetween(0.025, 0.06) * (Math.random() > 0.5 ? 1 : -1);
    const x = cx + Math.cos(angle) * orbitR;
    const y = cy + Math.sin(angle) * orbitR;
    return {
      ...baseFields(generateId(), x, y, 0, 0, r, color, pattern, true),
      orbitCx: cx, orbitCy: cy, orbitR, orbitAngle: angle, orbitSpeed: spd,
      spiralR: orbitR, spiralAngle: angle, spiralCx: cx, spiralCy: cy,
    };
  }

  if (pattern === 'bounce') {
    const x   = randomBetween(r, screenW - r);
    const y   = randomBetween(r, screenH - r);
    const ang = Math.random() * Math.PI * 2;
    const vx  = Math.cos(ang) * speed;
    const vy  = Math.sin(ang) * speed;
    return { ...baseFields(generateId(), x, y, vx, vy, r, color, pattern, true), baseVx: vx, baseVy: vy };
  }

  if (pattern === 'diagonal') {
    const corner = Math.floor(Math.random() * 4);
    const x    = corner % 2 === 0 ? -r : screenW + r;
    const y    = corner < 2       ? -r : screenH + r;
    const tx   = screenW * (0.3 + Math.random() * 0.4);
    const ty   = screenH * (0.3 + Math.random() * 0.4);
    const dist = Math.sqrt((tx - x) ** 2 + (ty - y) ** 2) || 1;
    const vx   = (tx - x) / dist * speed * 1.15;
    const vy   = (ty - y) / dist * speed * 1.15;
    return { ...baseFields(generateId(), x, y, vx, vy, r, color, pattern, true), baseVx: vx, baseVy: vy };
  }

  // straight / sine / zigzag / homing: spawn from a random edge aimed at centre.
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number;
  switch (edge) {
    case 0:  x = randomBetween(0, screenW); y = -r;           break;
    case 1:  x = screenW + r; y = randomBetween(0, screenH);  break;
    case 2:  x = randomBetween(0, screenW); y = screenH + r;  break;
    default: x = -r;          y = randomBetween(0, screenH);
  }
  const tx   = screenW * (0.25 + Math.random() * 0.5);
  const ty   = screenH * (0.25 + Math.random() * 0.5);
  const dist = Math.sqrt((tx - x) ** 2 + (ty - y) ** 2) || 1;
  const vx   = (tx - x) / dist * speed;
  const vy   = (ty - y) / dist * speed;
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
      const mag    = Math.sqrt(obs.baseVx ** 2 + obs.baseVy ** 2) || 1;
      const perpX  = -obs.baseVy / mag;
      const perpY  =  obs.baseVx / mag;
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
        const mag   = Math.sqrt(obs.baseVx ** 2 + obs.baseVy ** 2) || 1;
        const perpX = -obs.baseVy / mag;
        const perpY =  obs.baseVx / mag;
        const side  = age % 2 === 0 ? 1 : -1;
        const vx    = obs.baseVx + perpX * mag * side * 1.6;
        const vy    = obs.baseVy + perpY * mag * side * 1.6;
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
      const dx   = px - obs.x;
      const dy   = py - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = 0.055 * speed;
      let vx     = obs.vx * 0.96 + (dx / dist) * pull;
      let vy     = obs.vy * 0.96 + (dy / dist) * pull;
      const vmag = Math.sqrt(vx * vx + vy * vy) || 1;
      const cap  = speed * 1.5;
      if (vmag > cap) { vx = vx / vmag * cap; vy = vy / vmag * cap; }
      return { ...obs, age, x: obs.x + vx, y: obs.y + vy, vx, vy };
    }

    case 'spiral': {
      const r     = obs.spiralR * 0.982;
      const angle = obs.spiralAngle + obs.orbitSpeed;
      const x     = obs.spiralCx + Math.cos(angle) * r;
      const y     = obs.spiralCy + Math.sin(angle) * r;
      if (r < 18) {
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
  const [obstacles,     setObstacles]     = useState<ObstacleData[]>([]);
  const [score,         setScore]         = useState(0);
  const [phase,         setPhase]         = useState<GamePhase>('playing');
  const [chaosMode,     setChaosMode]     = useState(false);
  const [chaosBurst,    setChaosBurst]    = useState(false);
  const [wavePhaseText, setWavePhaseText] = useState('');
  const [powerUpDrops,  setPowerUpDrops]  = useState<PowerUpDrop[]>([]);

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
  const waveIndexRef       = useRef(-1);  // -1 forces transition logic to fire on tick 1
  const burstTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTextTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const powerUpDropsRef    = useRef<PowerUpDrop[]>([]);

  const tickRef = useRef<() => void>(() => {});

  tickRef.current = () => {
    if (phaseRef.current !== 'playing') return;

    const now     = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    // ── Wave transition check ─────────────────────────────────────────────────
    const { waveIndex, isChaosWave, calmWaveNum, speed } = getWaveState(elapsed);

    if (waveIndex !== waveIndexRef.current) {
      waveIndexRef.current     = waveIndex;
      chaosModeRef.current     = isChaosWave;
      setChaosMode(isChaosWave);

      // Toggle glow on every existing obstacle to match new wave phase.
      obstaclesRef.current = obstaclesRef.current.map((o) => ({ ...o, glowing: isChaosWave }));

      if (isChaosWave) {
        // Start burst flash
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        setChaosBurst(true);
        burstTimerRef.current = setTimeout(() => setChaosBurst(false), CHAOS_BURST_MS);
        setWavePhaseText('CHAOS MODE');
      } else if (waveIndex > 0) {
        // Returning to calm (skip label on the very first wave)
        setWavePhaseText('CALM BEFORE THE STORM');
      }

      // Clear the phase label after PHASE_TEXT_MS
      if (phaseTextTimerRef.current) clearTimeout(phaseTextTimerRef.current);
      phaseTextTimerRef.current = setTimeout(() => setWavePhaseText(''), PHASE_TEXT_MS);
    }

    // ── Spawn interval: chaos = fast, calm = moderate ─────────────────────────
    const spawnInterval = isChaosWave
      ? lerp(GAME_CONFIG.SPAWN_INTERVAL_MAX_MS, GAME_CONFIG.SPAWN_INTERVAL_MIN_MS, 0.8)
      : lerp(GAME_CONFIG.SPAWN_INTERVAL_MAX_MS, GAME_CONFIG.SPAWN_INTERVAL_MIN_MS, 0.3);

    // ── Spawn ─────────────────────────────────────────────────────────────────
    if (
      obstaclesRef.current.length < GAME_CONFIG.MAX_OBSTACLES &&
      now - lastSpawnRef.current >= spawnInterval
    ) {
      lastSpawnRef.current = now;
      const newObs = isChaosWave
        ? createChaosObstacle(screenWidth, screenHeight, speed)
        : createCalmObstacle(screenWidth, screenHeight, speed, calmWaveNum);
      obstaclesRef.current = [...obstaclesRef.current, newObs];
    }

    // ── Move + cull ───────────────────────────────────────────────────────────
    const px = playerX.value;
    const py = playerY.value;

    obstaclesRef.current = obstaclesRef.current
      .map((obs) => updateObstacle(obs, screenWidth, screenHeight, px, py, speed))
      .filter((obs) => !isOffScreen(obs, screenWidth, screenHeight));

    // ── Power-up drops (chaos waves only) ────────────────────────────────────
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

    // Check power-up collisions
    const remainingDrops: PowerUpDrop[] = [];
    for (const drop of powerUpDropsRef.current) {
      const dx = px - drop.x;
      const dy = py - drop.y;
      if (dx * dx + dy * dy < (GAME_CONFIG.PLAYER_RADIUS + POWERUP_RADIUS) ** 2) {
        // Collected — length change signals the consumer
      } else {
        remainingDrops.push(drop);
      }
    }
    if (remainingDrops.length !== powerUpDropsRef.current.length) {
      powerUpDropsRef.current = remainingDrops;
      setPowerUpDrops([...remainingDrops]);
    }

    // ── Score ─────────────────────────────────────────────────────────────────
    scoreRef.current += GAME_CONFIG.TICK_RATE_MS / 1000;
    const roundedScore = Math.floor(scoreRef.current);

    // ── Collision ─────────────────────────────────────────────────────────────
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
      if (loopRef.current)            clearInterval(loopRef.current);
      if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
      if (burstTimerRef.current)      clearTimeout(burstTimerRef.current);
      if (phaseTextTimerRef.current)  clearTimeout(phaseTextTimerRef.current);
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

  const acknowledgeDropCollected = useCallback((id: string) => {
    powerUpDropsRef.current = powerUpDropsRef.current.filter((d) => d.id !== id);
    setPowerUpDrops([...powerUpDropsRef.current]);
  }, []);

  return {
    obstacles,
    score,
    phase,
    chaosMode,     // true during chaos waves — game.tsx uses this for red background
    chaosBurst,    // 2.5 s flash at each chaos wave start — use for screen shake / flash
    wavePhaseText, // "CHAOS MODE" or "CALM BEFORE THE STORM" — render in game.tsx HUD
    powerUpDrops,
    pauseGame,
    resumeGame,
    revivePlayer,
    acknowledgeDropCollected,
  };
}
