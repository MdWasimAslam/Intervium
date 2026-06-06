/**
 * Infinite tier engine for the dashboard Progress Shield.
 *
 * Pure logic only — no I/O, no DB, no React. Safe to import on the server, in
 * the client card, and in unit tests. The score that feeds this is computed at
 * read time from existing tables (see `src/lib/progress.ts`); nothing here is
 * persisted.
 *
 * The system never ends:
 *   - Five rank names cycle forever: Apprentice → Candidate → Specialist →
 *     Expert → Master, then prestige into the next cycle (Apprentice II → … →
 *     Master II → Apprentice III → …).
 *   - `tierIndex` is the absolute, always-increasing tier number (0, 1, 2, …).
 *     `rankName = RANKS[tierIndex % 5]`, `cycle = floor(tierIndex / 5) + 1`.
 *
 * Thresholds grow on a super-linear power curve so early tiers come fast and
 * later ones are earned, with no cap:
 *
 *     threshold(t) = round(BASE * t^EXP)      (threshold(0) = 0)
 *
 * With BASE = 50 and EXP = 1.6 the ladder begins:
 *     t0 Apprentice·I    0
 *     t1 Candidate·I     50      (≈ one 5-question scored interview)
 *     t2 Specialist·I    152
 *     t3 Expert·I        290
 *     t4 Master·I        459
 *     t5 Apprentice·II   657     (first prestige)
 *     t10 Apprentice·III 1991
 *     t20 Apprentice·V   6030
 * and keeps widening forever.
 */

export const RANKS = [
  "Apprentice",
  "Candidate",
  "Specialist",
  "Expert",
  "Master",
] as const;

export type RankName = (typeof RANKS)[number];

/** Number of ranks before a prestige rollover into the next cycle. */
export const RANKS_PER_CYCLE = RANKS.length;

/** Curve constants — documented in the module comment above. */
const BASE = 50;
const EXP = 1.6;

/**
 * Cumulative points required to *reach* an absolute tier. Strictly increasing
 * for `t >= 1`, with `threshold(0) === 0`. Exported so tests can assert the
 * round-trip invariant without re-deriving the curve by hand.
 */
export function thresholdForTier(tierIndex: number): number {
  if (tierIndex <= 0) return 0;
  return Math.round(BASE * Math.pow(tierIndex, EXP));
}

export interface TierInfo {
  /** One of the five cycling rank names. */
  rankName: RankName;
  /** 1-based prestige cycle (1, 2, 3, …). */
  cycle: number;
  /** Absolute tier number, always increasing. */
  tierIndex: number;
  /** Points needed to have reached the current tier. */
  currentThreshold: number;
  /** Points needed to reach the next tier. */
  nextThreshold: number;
  /** Fraction of the way from the current tier to the next, in [0, 1]. */
  progressToNext: number;
  /** Points still needed to reach the next tier. */
  ptsToNext: number;
}

/**
 * Resolve the tier for a points total. Pure and total: non-finite or negative
 * inputs are treated as 0. O(1) regardless of magnitude — it seeds from the
 * closed-form inverse of the curve, then corrects by at most a step or two for
 * floating-point rounding, so even astronomically large totals are instant.
 */
export function tierFromPoints(total: number): TierInfo {
  const points = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;

  // Seed from the inverse of threshold = BASE * t^EXP, then nudge to the exact
  // tier (the float estimate can be off by one near a boundary).
  let tierIndex =
    points <= 0 ? 0 : Math.floor(Math.pow(points / BASE, 1 / EXP));
  if (tierIndex < 0) tierIndex = 0;
  while (thresholdForTier(tierIndex + 1) <= points) tierIndex++;
  while (tierIndex > 0 && thresholdForTier(tierIndex) > points) tierIndex--;

  const currentThreshold = thresholdForTier(tierIndex);
  const nextThreshold = thresholdForTier(tierIndex + 1);
  const span = nextThreshold - currentThreshold;
  const progressToNext = span > 0 ? (points - currentThreshold) / span : 0;

  return {
    rankName: RANKS[tierIndex % RANKS_PER_CYCLE],
    cycle: Math.floor(tierIndex / RANKS_PER_CYCLE) + 1,
    tierIndex,
    currentThreshold,
    nextThreshold,
    progressToNext: Math.max(0, Math.min(1, progressToNext)),
    ptsToNext: Math.max(0, nextThreshold - points),
  };
}

/** Roman numeral for a prestige cycle (1 → "I"). Falls back to the plain number above 3999. */
export function toRoman(value: number): string {
  if (!Number.isFinite(value) || value < 1) return "I";
  const n = Math.floor(value);
  if (n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = n;
  let out = "";
  for (const [num, sym] of table) {
    while (remaining >= num) {
      out += sym;
      remaining -= num;
    }
  }
  return out;
}
