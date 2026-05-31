/**
 * Tiny in-memory, per-key sliding-window rate limiter.
 *
 * IMPORTANT: state lives in this process's memory only. On serverless
 * (e.g. Vercel) each instance — and each cold start — has its own buckets, so
 * limits are NOT shared across instances and can reset at any time. This makes
 * the limiter strictly best-effort: it raises the cost of brute-force /
 * enumeration / abuse but must NOT be relied on as a hard security control.
 *
 * For real multi-instance enforcement in production, back this with a shared
 * store such as Redis / Upstash (a drop-in replacement behind allowAction).
 */
const buckets = new Map<string, number[]>();

/**
 * Returns true if the action is allowed (and records it), false if the key
 * has exceeded `max` actions within `windowMs`.
 */
export function allowAction(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    buckets.set(key, recent);
    return false;
  }

  recent.push(now);
  buckets.set(key, recent);
  return true;
}
