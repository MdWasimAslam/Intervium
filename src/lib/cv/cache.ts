/**
 * Content-addressed cache for the CV AI features (server-only).
 *
 * Identical input → identical `cacheKey` → the stored result is returned with
 * no AI call. This is the hard determinism guarantee (Groq's `seed` is only
 * best-effort) and a Groq-quota saver. Keyed by `feature:model:hash`, so a
 * model upgrade auto-invalidates. All operations are best-effort: a cache
 * read/write failure must never break the user-facing request.
 */
import { eq, sql } from "drizzle-orm";
import { aiCvCache, db } from "@db";
import { cvAiModelId } from "@/lib/groq";
import { fnv1a, stableStringify } from "./parse";

export type CvCacheFeature =
  | "cv_optimize"
  | "cv_import"
  | "cv_ats"
  | "cv_match";

/** Ignore cached rows older than this — lets model/prompt changes flow through. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function cacheKey(
  feature: CvCacheFeature,
  input: unknown,
): Promise<string> {
  return `${feature}:${await cvAiModelId(feature)}:${fnv1a(stableStringify(input))}`;
}

/** Return a cached result for this feature+input, or null on miss/expiry/error. */
export async function getCachedCvResult<T>(
  feature: CvCacheFeature,
  input: unknown,
): Promise<T | null> {
  try {
    const key = await cacheKey(feature, input);
    const [row] = await db
      .select({ result: aiCvCache.result, createdAt: aiCvCache.createdAt })
      .from(aiCvCache)
      .where(eq(aiCvCache.cacheKey, key));
    if (!row) return null;
    if (Date.now() - new Date(row.createdAt).getTime() > MAX_AGE_MS) return null;

    // Fire-and-forget hit counter; never let it affect the returned value.
    db.update(aiCvCache)
      .set({ hitCount: sql`${aiCvCache.hitCount} + 1` })
      .where(eq(aiCvCache.cacheKey, key))
      .then(
        () => {},
        () => {},
      );

    return row.result as T;
  } catch (error) {
    console.error("[cv-cache] read failed (non-fatal):", error);
    return null;
  }
}

/** Store a result for this feature+input. Best-effort; no-op on conflict/error. */
export async function putCachedCvResult(
  feature: CvCacheFeature,
  input: unknown,
  result: unknown,
): Promise<void> {
  try {
    const key = await cacheKey(feature, input);
    await db
      .insert(aiCvCache)
      .values({ cacheKey: key, feature, result })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[cv-cache] write failed (non-fatal):", error);
  }
}
