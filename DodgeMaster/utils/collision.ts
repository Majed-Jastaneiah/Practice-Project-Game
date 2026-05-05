/**
 * Returns true when two circles overlap.
 * Uses squared distances to avoid a sqrt on every tick.
 */
export function circleCollision(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const radiiSum = ar + br;
  return dx * dx + dy * dy < radiiSum * radiiSum;
}
