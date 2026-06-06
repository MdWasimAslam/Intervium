import "server-only";
import { desc, sql } from "drizzle-orm";
import { db, demoRequests } from "@db";

/**
 * Lightweight demo-access analytics: every "Email me my login" click upserts a
 * row keyed by email, so admins can see how many people are trying the demo.
 * All wrapped so analytics can never block the access flow or the admin page.
 */

/** Record one demo-access request (insert or bump the per-email counter). */
export async function recordDemoRequest(email: string): Promise<void> {
  try {
    await db
      .insert(demoRequests)
      .values({ email })
      .onConflictDoUpdate({
        target: demoRequests.email,
        set: {
          requestCount: sql`${demoRequests.requestCount} + 1`,
          lastRequestedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[recordDemoRequest]", error);
  }
}

export interface DemoRequestStats {
  /** Distinct emails that have requested access. */
  people: number;
  /** Total requests (sum of per-email counts). */
  requests: number;
  /** Most-recent requesters (capped) for an at-a-glance list. */
  recent: { email: string; count: number; lastRequestedAt: string }[];
}

/** Demo-access request stats for the admin panel. Returns zeros on any error. */
export async function getDemoRequestStats(): Promise<DemoRequestStats> {
  try {
    // Totals come from SQL aggregates so they stay accurate however many people
    // request access (a row-fetch-then-count would silently cap at its LIMIT).
    // The recent list is the only thing we bound, since it's just a preview.
    const [[totals], recent] = await Promise.all([
      db
        .select({
          people: sql<number>`count(*)::int`,
          requests: sql<number>`coalesce(sum(${demoRequests.requestCount}), 0)::int`,
        })
        .from(demoRequests),
      db
        .select({
          email: demoRequests.email,
          requestCount: demoRequests.requestCount,
          lastRequestedAt: demoRequests.lastRequestedAt,
        })
        .from(demoRequests)
        .orderBy(desc(demoRequests.lastRequestedAt))
        .limit(20),
    ]);

    return {
      people: totals?.people ?? 0,
      requests: totals?.requests ?? 0,
      recent: recent.map((r) => ({
        email: r.email,
        count: r.requestCount,
        lastRequestedAt: r.lastRequestedAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[getDemoRequestStats]", error);
    return { people: 0, requests: 0, recent: [] };
  }
}
