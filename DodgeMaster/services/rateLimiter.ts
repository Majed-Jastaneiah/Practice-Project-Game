/**
 * Client-side rate limiter for authentication attempts.
 *
 * This is a first line of defence — Firebase also enforces server-side
 * rate limits. Using both prevents rapid enumeration attacks even before
 * requests reach the network.
 *
 * Policy: max 5 failures per email per 60-second window.
 * On lockout, the caller must wait before trying again.
 */

interface Bucket {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minute lockout after max attempts

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  const existing = buckets.get(key);
  const now = Date.now();

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    // New window
    const fresh: Bucket = { count: 0, windowStart: now, lockedUntil: null };
    buckets.set(key, fresh);
    return fresh;
  }

  return existing;
}

/**
 * Call before every login attempt.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs: number }`.
 */
export function checkRateLimit(
  email: string,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const key = email.toLowerCase().trim();
  const bucket = getBucket(key);
  const now = Date.now();

  if (bucket.lockedUntil !== null && now < bucket.lockedUntil) {
    return { allowed: false, retryAfterMs: bucket.lockedUntil - now };
  }

  return { allowed: true };
}

/**
 * Call after each failed login attempt.
 * Increments the counter and applies a lockout if the limit is exceeded.
 */
export function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase().trim();
  const bucket = getBucket(key);
  bucket.count += 1;

  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.lockedUntil = Date.now() + LOCKOUT_MS;
  }
}

/** Call after a successful login to reset the failure counter. */
export function recordSuccess(email: string): void {
  buckets.delete(email.toLowerCase().trim());
}

/** How many seconds until the lockout expires (0 if not locked). */
export function secondsUntilUnlocked(email: string): number {
  const key = email.toLowerCase().trim();
  const bucket = buckets.get(key);
  if (!bucket?.lockedUntil) return 0;
  const remaining = bucket.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
