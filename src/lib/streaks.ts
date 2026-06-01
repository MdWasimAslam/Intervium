/**
 * Practice-cadence streaks, derived from the set of days an activity happened.
 * Pure and dependency-free (no DB, no `server-only`) so any data layer can
 * reuse it — interviews (session start dates) and Code Dojo (attempt dates).
 */

export interface StreakInfo {
  /** Consecutive days active, counting back from today (UTC). */
  current: number;
  /** Longest consecutive-day run ever. */
  longest: number;
  /** Activity events in the last 7 days. */
  thisWeek: number;
  /** Whether there was activity today (UTC) — drives the "active" flame. */
  activeToday: boolean;
}

/** UTC day index for a timestamp (days since epoch), for streak arithmetic. */
const dayNum = (d: Date) => Math.floor(d.getTime() / 86_400_000);

/**
 * Derive streaks/cadence from the timestamps of an activity. Streaks are
 * measured in UTC days. The current streak stays "alive" if the most recent
 * day was yesterday (today simply hasn't been practised yet).
 */
export function computeStreaks(timestamps: Date[], now: Date): StreakInfo {
  const todayNum = dayNum(now);
  const weekAgoMs = now.getTime() - 7 * 86_400_000;
  const thisWeek = timestamps.filter((d) => d.getTime() >= weekAgoMs).length;

  const days = [...new Set(timestamps.map(dayNum))].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const di of days) {
    run = prev !== null && di === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = di;
  }

  const present = new Set(days);
  let current = 0;
  let cursor = present.has(todayNum)
    ? todayNum
    : present.has(todayNum - 1)
      ? todayNum - 1
      : null;
  while (cursor !== null && present.has(cursor)) {
    current++;
    cursor--;
  }

  return { current, longest, thisWeek, activeToday: present.has(todayNum) };
}
