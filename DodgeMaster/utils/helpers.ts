/** Linearly interpolate between a and b by t (clamped 0–1). */
export function lerp(a: number, b: number, t: number): number {
  'worklet';
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return a + (b - a) * clamped;
}

/** Clamp value between min and max. Marked worklet so gesture handlers can use it. */
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return value < min ? min : value > max ? max : value;
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}
