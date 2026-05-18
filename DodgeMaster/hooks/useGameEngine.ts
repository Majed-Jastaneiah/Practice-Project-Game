import { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_CONFIG } from '@/constants/GameConfig';
import { Colors } from '@/constants/Colors';
import { randomBetween, generateId } from '@/utils/helpers';
import type { ObstacleData, GamePhase } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CENTER_BALL_RADIUS = 10; // exported so PlayerDot can match exactly

const INITIAL_LIVES     = 5;
const POINTS_PER_SHAPE  = 15;
const SPEED_BASE        = 1.4;  // px/tick at game start
const SPEED_MAX         = 5.5;  // px/tick at full difficulty
const DIFFICULTY_RAMP_S = 90;
const SPAWN_INTERVAL_MS = 1300;
const SPAWN_MIN_MS      = 380;
const MAX_SHAPES        = 22;
const CHAOS_INTERVAL_S     = 20;   // seconds between chaos mode changes
const SLICE_TOLERANCE      = 10;   // extra radius for swipe hit detection
const POWER_UP_SPAWN_MS    = 10_000;
const POWER_UP_LIFETIME_MS = 5_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ShapePattern = 'straight' | 'diagonal' | 'zigzag' | 'rotating';

interface Shape extends ObstacleData {
  pattern: ShapePattern;
  speed: number;
  rotationAngle: number;  // visual spin for 'rotating' pattern
  zigzagTimer: number;
}

export interface SlicePoint { x: number; y: number; }

export type ChaosMode   = 'none' | 'fire' | 'ice' | 'thunder';
export type PowerUpType = 'kill_all' | 'extra_points' | 'slow_down' | 'extra_lives' | 'mystery_box';
export interface PowerUp {
  id: string; x: number; y: number;
  type: PowerUpType; spawnTime: number;
}

interface UseGameEngineParams {
  screenWidth: number;
  screenHeight: number;
  onDeath: (finalScore: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getChaosColor(mode: ChaosMode): string {
  if (mode === 'fire')    { const c = ['#FF4500','#FF6B00','#FF8C00','#FF2200','#FF7700']; return c[Math.floor(Math.random()*c.length)]; }
  if (mode === 'ice')     { const c = ['#00E5FF','#00B4D8','#90E0EF','#48CAE4','#B3E5FC']; return c[Math.floor(Math.random()*c.length)]; }
  if (mode === 'thunder') { const c = ['#4FC3F7','#7C4DFF','#FFFFFF','#00E5FF','#CE93D8']; return c[Math.floor(Math.random()*c.length)]; }
  return Colors.obstacles[Math.floor(Math.random() * Colors.obstacles.length)];
}
function randRadius() {
  return Math.round(randomBetween(GAME_CONFIG.OBSTACLE_MIN_RADIUS, GAME_CONFIG.OBSTACLE_MAX_RADIUS));
}

// ─── Shape factory ────────────────────────────────────────────────────────────

const SPEED_MULTS = [0.55, 0.75, 1.0, 1.35, 1.8] as const;

function createShape(
  screenW: number, screenH: number,
  baseSpeed: number,
  cx: number, cy: number,
  chaosMode: ChaosMode = 'none',
): Shape {
  const patterns: ShapePattern[] = ['straight', 'diagonal', 'zigzag', 'rotating'];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const r       = randRadius();
  const speed   = baseSpeed * SPEED_MULTS[Math.floor(Math.random() * SPEED_MULTS.length)];

  let x: number, y: number;

  if (pattern === 'diagonal') {
    // Corners only
    const corner = Math.floor(Math.random() * 4);
    x = corner % 2 === 0 ? -r : screenW + r;
    y = corner < 2       ? -r : screenH + r;
  } else {
    // Random edge
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0:  x = randomBetween(r, screenW - r); y = -r;          break;
      case 1:  x = screenW + r; y = randomBetween(r, screenH - r); break;
      case 2:  x = randomBetween(r, screenW - r); y = screenH + r; break;
      default: x = -r;          y = randomBetween(r, screenH - r);
    }
  }

  // Initial velocity aimed at centre
  const dx   = cx - x;
  const dy   = cy - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const vx   = (dx / dist) * speed;
  const vy   = (dy / dist) * speed;

  return {
    id: generateId(),
    x, y, vx, vy,
    radius: r,
    color: getChaosColor(chaosMode),
    glowing: false,
    pattern,
    speed,
    rotationAngle: 0,
    zigzagTimer: Math.floor(randomBetween(12, 26)),
  };
}

// ─── Shape movement ───────────────────────────────────────────────────────────

function updateShape(
  s: Shape, screenW: number, screenH: number, cx: number, cy: number, speedScale = 1,
): Shape {
  let { x, y, vx, vy, rotationAngle, zigzagTimer } = s;
  const sp = s.speed * speedScale; // effective speed for this tick

  const dx   = cx - x;
  const dy   = cy - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const tx   = dx / dist;
  const ty   = dy / dist;

  switch (s.pattern) {
    case 'straight':
    case 'diagonal':
      vx = tx * sp;
      vy = ty * sp;
      break;

    case 'zigzag': {
      const t = zigzagTimer - 1;
      if (t <= 0) {
        const side  = Math.random() > 0.5 ? 1 : -1;
        const perpX = -ty;
        const perpY =  tx;
        vx = tx * sp + perpX * sp * side * 1.8;
        vy = ty * sp + perpY * sp * side * 1.8;
        zigzagTimer = Math.floor(randomBetween(12, 26));
      } else {
        vx = vx * 0.84 + tx * sp * 0.16;
        vy = vy * 0.84 + ty * sp * 0.16;
        zigzagTimer = t;
      }
      break;
    }

    case 'rotating':
      vx = tx * sp;
      vy = ty * sp;
      rotationAngle = (rotationAngle + 7) % 360;
      break;
  }

  x += vx;
  y += vy;

  let bounced = false;
  if (x - s.radius < 0)            { x = s.radius;          vx =  Math.abs(vx); bounced = true; }
  else if (x + s.radius > screenW) { x = screenW - s.radius; vx = -Math.abs(vx); bounced = true; }
  if (y - s.radius < 0)            { y = s.radius;          vy =  Math.abs(vy); bounced = true; }
  else if (y + s.radius > screenH) { y = screenH - s.radius; vy = -Math.abs(vy); bounced = true; }

  if (bounced) {
    vx = vx * 0.5 + tx * sp * 0.5;
    vy = vy * 0.5 + ty * sp * 0.5;
  }

  return { ...s, x, y, vx, vy, rotationAngle, zigzagTimer };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

function circleHitsSegment(
  cx: number, cy: number, cr: number,
  ax: number, ay: number, bx: number, by: number,
): boolean {
  const dx   = bx - ax;
  const dy   = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t     = lenSq > 0 ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq)) : 0;
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return (cx - closestX) ** 2 + (cy - closestY) ** 2 <= (cr + SLICE_TOLERANCE) ** 2;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameEngine({ screenWidth, screenHeight, onDeath }: UseGameEngineParams) {
  const centerX = screenWidth  / 2;
  const centerY = screenHeight / 2;

  const [shapes,           setShapes]           = useState<ObstacleData[]>([]);
  const [score,            setScore]            = useState(0);
  const [lives,            setLives]            = useState(INITIAL_LIVES);
  const [phase,            setPhase]            = useState<GamePhase>('playing');
  const [hitEffect,        setHitEffect]        = useState(false);
  const [chaosMode,       setChaosMode]       = useState<ChaosMode>('none');
  const [survivalTime,    setSurvivalTime]    = useState(0);
  const [powerUps,        setPowerUps]        = useState<PowerUp[]>([]);
  const [mysteryBoxCount, setMysteryBoxCount] = useState(0);
  const [scoreMultiplier, setScoreMultiplier] = useState(1);
  const [slowActive,      setSlowActive]      = useState(false);

  const shapesRef    = useRef<Shape[]>([]);
  const scoreRef     = useRef(0);
  const livesRef     = useRef(INITIAL_LIVES);
  const phaseRef     = useRef<GamePhase>('playing');
  const loopRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpawnRef = useRef(Date.now());
  const startTimeRef = useRef(Date.now());
  const hasDeadRef   = useRef(false);
  const hitTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chaosModeRef        = useRef<ChaosMode>('none');
  const lastPowerUpSpawnRef = useRef(Date.now());
  const powerUpsRef         = useRef<PowerUp[]>([]);
  const mysteryBoxCountRef  = useRef(0);
  const scoreMultRef        = useRef(1);
  const slowActiveRef       = useRef(false);
  const slowTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraPointsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimerSecRef     = useRef(-1);

  // Activation logic in a ref so stable useCallback closures always call the latest version
  const activatePowerUpRef = useRef<(type: PowerUpType) => void>(() => {});
  activatePowerUpRef.current = (type: PowerUpType) => {
    switch (type) {
      case 'kill_all':
        shapesRef.current = [];
        setShapes([]);
        break;
      case 'extra_points':
        if (extraPointsTimerRef.current) clearTimeout(extraPointsTimerRef.current);
        scoreMultRef.current = 2;
        setScoreMultiplier(2);
        extraPointsTimerRef.current = setTimeout(() => {
          scoreMultRef.current = 1;
          setScoreMultiplier(1);
        }, 10_000);
        break;
      case 'slow_down':
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        slowActiveRef.current = true;
        setSlowActive(true);
        slowTimerRef.current = setTimeout(() => {
          slowActiveRef.current = false;
          setSlowActive(false);
        }, 8_000);
        break;
      case 'extra_lives':
        livesRef.current = Math.min(livesRef.current + 2, INITIAL_LIVES + 10);
        setLives(livesRef.current);
        break;
      case 'mystery_box':
        mysteryBoxCountRef.current += 1;
        setMysteryBoxCount(mysteryBoxCountRef.current);
        break;
    }
  };

  const tickRef = useRef<() => void>(() => {});

  tickRef.current = () => {
    if (phaseRef.current !== 'playing') return;

    const now     = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    const t             = Math.min(elapsed / DIFFICULTY_RAMP_S, 1);
    const speed         = SPEED_BASE + (SPEED_MAX - SPEED_BASE) * t;
    const spawnInterval = SPAWN_INTERVAL_MS - (SPAWN_INTERVAL_MS - SPAWN_MIN_MS) * t;

    // ── Survival timer (update once per second) ───────────────────────────────
    const elapsedSec = Math.floor(elapsed);
    if (elapsedSec !== lastTimerSecRef.current) {
      lastTimerSecRef.current = elapsedSec;
      setSurvivalTime(elapsedSec);
    }

    // ── Chaos mode cycles every 20 s: none→fire→ice→thunder→fire→… ───────────
    const chaosCycle = Math.floor(elapsed / CHAOS_INTERVAL_S);
    const cycledMode: ChaosMode = chaosCycle === 0
      ? 'none'
      : (['fire', 'ice', 'thunder'] as ChaosMode[])[(chaosCycle - 1) % 3];
    if (cycledMode !== chaosModeRef.current) {
      chaosModeRef.current = cycledMode;
      setChaosMode(cycledMode);
      shapesRef.current = shapesRef.current.map(s => ({ ...s, color: getChaosColor(cycledMode) }));
    }
    // Each chaos cycle after the first adds 20% speed (cumulative)
    const chaosSpeedMult = 1.0 + Math.max(0, chaosCycle - 1) * 0.2;
    const slowFactor     = slowActiveRef.current ? 0.35 : 1;
    const speedScale     = chaosSpeedMult * slowFactor;

    // ── Spawn ──────────────────────────────────────────────────────────────────
    if (shapesRef.current.length < MAX_SHAPES && now - lastSpawnRef.current >= spawnInterval) {
      lastSpawnRef.current = now;
      shapesRef.current = [
        ...shapesRef.current,
        createShape(screenWidth, screenHeight, speed, centerX, centerY, chaosModeRef.current),
      ];
    }

    // ── Power-ups: spawn every 10 s, despawn after 5 s ────────────────────────
    let puChanged = false;
    if (now - lastPowerUpSpawnRef.current >= POWER_UP_SPAWN_MS) {
      lastPowerUpSpawnRef.current = now;
      const puTypes: PowerUpType[] = ['shield', 'slow', 'clear'];
      const puType = puTypes[Math.floor(Math.random() * puTypes.length)];
      const edge = Math.floor(Math.random() * 4);
      let px = 0, py = 0;
      switch (edge) {
        case 0:  px = randomBetween(40, screenWidth  - 40); py = 70;                               break;
        case 1:  px = screenWidth  - 70;                    py = randomBetween(80, screenHeight - 80); break;
        case 2:  px = randomBetween(40, screenWidth  - 40); py = screenHeight - 70;                break;
        default: px = 70;                                   py = randomBetween(80, screenHeight - 80);
      }
      powerUpsRef.current = [...powerUpsRef.current, { id: generateId(), x: px, y: py, type: puType, spawnTime: now }];
      puChanged = true;
    }
    const remainingPU = powerUpsRef.current.filter(p => now - p.spawnTime < POWER_UP_LIFETIME_MS);
    if (remainingPU.length !== powerUpsRef.current.length) puChanged = true;
    powerUpsRef.current = remainingPU;
    if (puChanged) setPowerUps([...powerUpsRef.current]);

    // ── Move + centre-collision ───────────────────────────────────────────────
    let livesLost = 0;
    const surviving: Shape[] = [];

    for (const s of shapesRef.current) {
      const updated = updateShape(s, screenWidth, screenHeight, centerX, centerY, speedScale);
      const d = Math.sqrt((updated.x - centerX) ** 2 + (updated.y - centerY) ** 2);
      if (d < CENTER_BALL_RADIUS + updated.radius * 0.65) {
        livesLost++;
      } else {
        surviving.push(updated);
      }
    }
    shapesRef.current = surviving;

    // ── Lives update ──────────────────────────────────────────────────────────
    if (livesLost > 0) {
      livesRef.current = Math.max(0, livesRef.current - livesLost);
      setLives(livesRef.current);

      if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
      setHitEffect(true);
      hitTimerRef.current = setTimeout(() => setHitEffect(false), 420);

      if (livesRef.current <= 0 && !hasDeadRef.current) {
        hasDeadRef.current  = true;
        phaseRef.current    = 'dead';
        setPhase('dead');
        if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
        return; // game.tsx shows dead overlay — player chooses revive or quit
      }
    }

    setShapes([...shapesRef.current]);
  };

  useEffect(() => {
    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
    return () => {
      if (loopRef.current)             clearInterval(loopRef.current);
      if (hitTimerRef.current)         clearTimeout(hitTimerRef.current);
      if (slowTimerRef.current)        clearTimeout(slowTimerRef.current);
      if (extraPointsTimerRef.current) clearTimeout(extraPointsTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public: tap to destroy single shape ──────────────────────────────────────

  const destroyShapeAt = useCallback((tapX: number, tapY: number) => {
    // Power-up tap: activate immediately (mystery_box stores itself)
    let collected = false;
    powerUpsRef.current = powerUpsRef.current.filter((p) => {
      if (collected) return true;
      const dx = tapX - p.x;
      const dy = tapY - p.y;
      if (dx * dx + dy * dy < 35 * 35) {
        activatePowerUpRef.current(p.type);
        collected = true;
        return false;
      }
      return true;
    });
    if (collected) { setPowerUps([...powerUpsRef.current]); return; }

    let hit = false;
    shapesRef.current = shapesRef.current.filter((s) => {
      if (hit) return true;
      const dx = tapX - s.x;
      const dy = tapY - s.y;
      if (dx * dx + dy * dy < (s.radius + 16) ** 2) {
        scoreRef.current += POINTS_PER_SHAPE * scoreMultRef.current;
        setScore(scoreRef.current);
        hit = true;
        return false;
      }
      return true;
    });
  }, []);

  // ── Public: swipe to destroy shapes along path ───────────────────────────────

  const destroyShapesAlongPath = useCallback((pts: SlicePoint[]) => {
    if (pts.length < 2) return;

    // Power-ups sliced along the path activate immediately
    let puChanged = false;
    powerUpsRef.current = powerUpsRef.current.filter((p) => {
      for (let i = 0; i < pts.length - 1; i++) {
        if (circleHitsSegment(p.x, p.y, 20, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) {
          activatePowerUpRef.current(p.type);
          puChanged = true;
          return false;
        }
      }
      return true;
    });
    if (puChanged) setPowerUps([...powerUpsRef.current]);

    let gained = 0;
    shapesRef.current = shapesRef.current.filter((s) => {
      for (let i = 0; i < pts.length - 1; i++) {
        if (circleHitsSegment(s.x, s.y, s.radius, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) {
          gained += POINTS_PER_SHAPE * scoreMultRef.current;
          return false;
        }
      }
      return true;
    });
    if (gained > 0) {
      scoreRef.current += gained;
      setScore(scoreRef.current);
    }
  }, []);

  // ── Pause / resume ────────────────────────────────────────────────────────────

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'paused';
    setPhase('paused');
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
  }, []);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    phaseRef.current = 'playing';
    setPhase('playing');
    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
  }, []);

  // ── Revive: keeps score & time, clears shapes, restores 3 lives ──────────────
  const revive = useCallback(() => {
    if (phaseRef.current !== 'dead') return;
    livesRef.current   = 3;
    setLives(3);
    shapesRef.current  = [];
    setShapes([]);
    hasDeadRef.current = false;
    phaseRef.current   = 'playing';
    setPhase('playing');
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
  }, []);

  // ── Mystery box: spend one stored box, apply chosen reward ───────────────────
  const useMysteryBox = useCallback((choice: PowerUpType) => {
    if (mysteryBoxCountRef.current <= 0) return;
    mysteryBoxCountRef.current -= 1;
    setMysteryBoxCount(mysteryBoxCountRef.current);
    activatePowerUpRef.current(choice);
  }, []);

  return {
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
    scoreMultiplier,
    slowActive,
    destroyShapeAt,
    destroyShapesAlongPath,
    pauseGame,
    resumeGame,
    revive,
    useMysteryBox,
  };
}
