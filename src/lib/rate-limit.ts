/**
 * Tiny in-memory, per-key sliding-window rate limiter.
 *
 * Good enough to throttle expensive Groq generation per user during a
 * single server instance's lifetime. For multi-instance production you'd back
 * this with Redis/Upstash, but that's out of scope here.
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
