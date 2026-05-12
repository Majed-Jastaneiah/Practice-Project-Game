import { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_CONFIG } from '@/constants/GameConfig';
import { Colors } from '@/constants/Colors';
import { randomBetween, generateId } from '@/utils/helpers';
import type { ObstacleData, GamePhase } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CENTER_BALL_RADIUS = 26; // exported so PlayerDot can match exactly

const INITIAL_LIVES     = 5;
const POINTS_PER_SHAPE  = 15;
const SPEED_BASE        = 1.4;  // px/tick at game start
const SPEED_MAX         = 5.5;  // px/tick at full difficulty
const DIFFICULTY_RAMP_S = 90;
const SPAWN_INTERVAL_MS = 1300;
const SPAWN_MIN_MS      = 380;
const MAX_SHAPES        = 22;
const SLICE_TOLERANCE   = 10;   // extra radius for swipe hit detection

// ─── Types ────────────────────────────────────────────────────────────────────

type ShapePattern = 'straight' | 'diagonal' | 'zigzag' | 'rotating';

interface Shape extends ObstacleData {
  pattern: ShapePattern;
  speed: number;
  rotationAngle: number;  // visual spin for 'rotating' pattern
  zigzagTimer: number;
}

export interface SlicePoint { x: number; y: number; }

interface UseGameEngineParams {
  screenWidth: number;
  screenHeight: number;
  onDeath: (finalScore: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randColor() {
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
    color: randColor(),
    glowing: false,
    pattern,
    speed,
    rotationAngle: 0,
    zigzagTimer: Math.floor(randomBetween(12, 26)),
  };
}

// ─── Shape movement ───────────────────────────────────────────────────────────

function updateShape(
  s: Shape, screenW: number, screenH: number, cx: number, cy: number,
): Shape {
  let { x, y, vx, vy, rotationAngle, zigzagTimer } = s;

  // Unit vector toward centre
  const dx   = cx - x;
  const dy   = cy - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const tx   = dx / dist;
  const ty   = dy / dist;

  switch (s.pattern) {
    case 'straight':
    case 'diagonal':
      // Always re-aim directly at centre
      vx = tx * s.speed;
      vy = ty * s.speed;
      break;

    case 'zigzag': {
      const t = zigzagTimer - 1;
      if (t <= 0) {
        const side  = Math.random() > 0.5 ? 1 : -1;
        const perpX = -ty;
        const perpY =  tx;
        vx = tx * s.speed + perpX * s.speed * side * 1.8;
        vy = ty * s.speed + perpY * s.speed * side * 1.8;
        zigzagTimer = Math.floor(randomBetween(12, 26));
      } else {
        // Gradually blend back toward centre
        vx = vx * 0.84 + tx * s.speed * 0.16;
        vy = vy * 0.84 + ty * s.speed * 0.16;
        zigzagTimer = t;
      }
      break;
    }

    case 'rotating':
      vx = tx * s.speed;
      vy = ty * s.speed;
      rotationAngle = (rotationAngle + 7) % 360;
      break;
  }

  x += vx;
  y += vy;

  // Wall bounce — reflect then blend in a centre pull to avoid wall-hugging
  let bounced = false;
  if (x - s.radius < 0)          { x = s.radius;          vx =  Math.abs(vx); bounced = true; }
  else if (x + s.radius > screenW) { x = screenW - s.radius; vx = -Math.abs(vx); bounced = true; }
  if (y - s.radius < 0)          { y = s.radius;          vy =  Math.abs(vy); bounced = true; }
  else if (y + s.radius > screenH) { y = screenH - s.radius; vy = -Math.abs(vy); bounced = true; }

  if (bounced) {
    // Mix reflected velocity with a centre pull (50/50)
    vx = vx * 0.5 + tx * s.speed * 0.5;
    vy = vy * 0.5 + ty * s.speed * 0.5;
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

  const [shapes,    setShapes]    = useState<ObstacleData[]>([]);
  const [score,     setScore]     = useState(0);
  const [lives,     setLives]     = useState(INITIAL_LIVES);
  const [phase,     setPhase]     = useState<GamePhase>('playing');
  const [hitEffect, setHitEffect] = useState(false);

  const shapesRef    = useRef<Shape[]>([]);
  const scoreRef     = useRef(0);
  const livesRef     = useRef(INITIAL_LIVES);
  const phaseRef     = useRef<GamePhase>('playing');
  const loopRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpawnRef = useRef(Date.now());
  const startTimeRef = useRef(Date.now());
  const hasDeadRef   = useRef(false);
  const hitTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tickRef = useRef<() => void>(() => {});

  tickRef.current = () => {
    if (phaseRef.current !== 'playing') return;

    const now     = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    const t             = Math.min(elapsed / DIFFICULTY_RAMP_S, 1);
    const speed         = SPEED_BASE + (SPEED_MAX - SPEED_BASE) * t;
    const spawnInterval = SPAWN_INTERVAL_MS - (SPAWN_INTERVAL_MS - SPAWN_MIN_MS) * t;

    // ── Spawn ──────────────────────────────────────────────────────────────────
    if (shapesRef.current.length < MAX_SHAPES && now - lastSpawnRef.current >= spawnInterval) {
      lastSpawnRef.current = now;
      shapesRef.current = [
        ...shapesRef.current,
        createShape(screenWidth, screenHeight, speed, centerX, centerY),
      ];
    }

    // ── Move + centre-collision ───────────────────────────────────────────────
    let livesLost = 0;
    const surviving: Shape[] = [];

    for (const s of shapesRef.current) {
      const updated = updateShape(s, screenWidth, screenHeight, centerX, centerY);
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
        onDeath(scoreRef.current);
        return;
      }
    }

    setShapes([...shapesRef.current]);
  };

  useEffect(() => {
    loopRef.current = setInterval(() => tickRef.current(), GAME_CONFIG.TICK_RATE_MS);
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
      if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public: tap to destroy single shape ──────────────────────────────────────

  const destroyShapeAt = useCallback((tapX: number, tapY: number) => {
    let hit = false;
    shapesRef.current = shapesRef.current.filter((s) => {
      if (hit) return true;
      const dx = tapX - s.x;
      const dy = tapY - s.y;
      if (dx * dx + dy * dy < (s.radius + 16) ** 2) {
        scoreRef.current += POINTS_PER_SHAPE;
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
    let gained = 0;
    shapesRef.current = shapesRef.current.filter((s) => {
      for (let i = 0; i < pts.length - 1; i++) {
        if (circleHitsSegment(s.x, s.y, s.radius, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) {
          gained += POINTS_PER_SHAPE;
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

  return {
    shapes,
    score,
    lives,
    phase,
    hitEffect,   // true for ~420 ms each time a shape reaches centre — flash centre ball red
    centerX,
    centerY,
    destroyShapeAt,
    destroyShapesAlongPath,
    pauseGame,
    resumeGame,
  };
}
