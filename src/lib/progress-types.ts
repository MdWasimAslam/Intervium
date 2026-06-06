import { z } from "zod";

/**
 * Client-safe constants, schemas, and types for the Progress Shield.
 *
 * Kept separate from `progress.ts` (which imports `@db`/`pg` and is marked
 * `server-only`) so the client card can import the point weights and types
 * without dragging the database driver into the browser bundle.
 *
 * Weights — also surfaced to the user as the "how to earn" legend:
 *   - scored interview answer → 10 pts
 *   - solved Dojo problem     → 15 pts
 *   - study note added        →  3 pts
 */
export const POINTS = {
  /** Per scored, answered interview question. */
  interviews: 10,
  /** Per distinct solved Dojo problem. */
  dojo: 15,
  /** Per study note added. */
  notes: 3,
} as const;

export const progressSourceSchema = z.enum(["interviews", "dojo", "notes"]);
export type ProgressSource = z.infer<typeof progressSourceSchema>;

const sourceCountSchema = z.object({
  count: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
});

export const progressScoreSchema = z.object({
  total: z.number().int().nonnegative(),
  bySource: z.object({
    interviews: sourceCountSchema,
    dojo: sourceCountSchema,
    notes: sourceCountSchema,
  }),
  /** Points earned in the last 7 days (drives the "+this week" delta). */
  last7days: z.number().int().nonnegative(),
  /** The most recent point-earning event, or null when nothing has been earned. */
  lastEarned: z
    .object({
      source: progressSourceSchema,
      points: z.number().int().positive(),
      at: z.date(),
    })
    .nullable(),
});
export type ProgressScore = z.infer<typeof progressScoreSchema>;
