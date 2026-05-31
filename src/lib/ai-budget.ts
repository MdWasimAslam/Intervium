import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, aiUsage } from "@db";

/**
 * Thrown when an AI operation can't run because today's budget is spent.
 * Distinct from a hard failure: the work is deferred, not lost — callers
 * surface a friendly "try again later" rather than persisting a zero score.
 */
export class AiBudgetError extends Error {}

/**
 * DB-backed daily AI-call budget guard.
 *
 * The per-action rate limiter (`allowAction`) lives in process memory and
 * resets on every serverless cold start, so it can't protect a *daily* cap.
 * This counter lives in Postgres (`ai_usage`, one row per UTC day), so it is a
 * real running total against Groq's free-tier per-day limit — across every
 * cold start and function invocation.
 *
 * Callers reserve *before* hitting Groq and degrade gracefully when the
 * budget is spent (serve from cache / store a "try later" note) instead of
 * letting the request reach Groq and 429.
 */

/**
 * Soft ceiling, kept comfortably below Groq's free-tier daily cap so a burst
 * of retries can't blow past the real limit. Override via env if your project's
 * live limit differs (see https://aistudio.google.com/rate-limit).
 */
const DAILY_BUDGET = Math.max(
  1,
  Number(process.env.AI_DAILY_BUDGET) || 180,
);

/** UTC calendar day key, "YYYY-MM-DD". */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically reserve `n` AI calls against today's budget.
 *
 * Returns `true` if the reservation fits within the daily budget (and records
 * it), `false` if it would exceed the cap. On a DB error we fail OPEN (return
 * `true`) — the in-memory per-user rate limiter and Groq's own 429 remain as
 * backstops, and we'd rather not block a legitimate interview because the
 * counter table hiccuped.
 */
export async function reserveAiCalls(n = 1): Promise<boolean> {
  const day = today();
  try {
    // Upsert-and-increment in one round trip; returns the new running total.
    const [row] = await db
      .insert(aiUsage)
      .values({ day, count: n })
      .onConflictDoUpdate({
        target: aiUsage.day,
        set: { count: sql`${aiUsage.count} + ${n}`, updatedAt: new Date() },
      })
      .returning({ count: aiUsage.count });

    if ((row?.count ?? n) > DAILY_BUDGET) {
      // Over budget — give back what we just reserved so the total stays honest.
      await db
        .update(aiUsage)
        .set({ count: sql`${aiUsage.count} - ${n}` })
        .where(eq(aiUsage.day, day));
      return false;
    }
    return true;
  } catch (error) {
    console.error("[ai-budget] reserve failed, failing open:", error);
    return true;
  }
}

/** Calls still available today (never negative). For diagnostics/logging. */
export async function aiCallsRemaining(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: aiUsage.count })
      .from(aiUsage)
      .where(eq(aiUsage.day, today()));
    return Math.max(0, DAILY_BUDGET - (row?.count ?? 0));
  } catch {
    return DAILY_BUDGET;
  }
}
