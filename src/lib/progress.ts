import "server-only";
import { cache } from "react";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  dojoProgress,
  interviewSessions,
  sessionQuestions,
  studyNotes,
  techStacks,
} from "@db";
import {
  POINTS,
  progressScoreSchema,
  type ProgressScore,
  type ProgressSource,
} from "@/lib/progress-types";

// Re-export the client-safe surface so existing `@/lib/progress` imports keep
// working; the runtime values/schemas now live in the db-free types module.
export {
  POINTS,
  progressSourceSchema,
  progressScoreSchema,
  type ProgressSource,
  type ProgressScore,
} from "@/lib/progress-types";

/**
 * Read-time "Progress Shield" score.
 *
 * Cumulative, gamified progress computed entirely from data that already
 * exists — no new tables, columns, or migrations. Every count is scoped to the
 * caller's `userId`; the read is wrapped in React `cache` so a single request
 * (page + any nested components) computes it at most once.
 *
 * Weights (also surfaced to the user as the "how to earn" legend):
 *   - scored interview answer  → 10 pts
 *   - solved Dojo problem      → 15 pts
 *   - study note added         →  3 pts
 *
 * "Completed work only":
 *   - interviews: a `session_questions` row whose parent session is scored
 *     (`scoredAt` set) AND that was actually answered (`answeredAt` set) — so
 *     skipped/empty questions never earn points.
 *   - dojo: rows in the per-(user, question) `dojo_progress` rollup with
 *     `solved = true` — one point per distinct solved problem, no double-count.
 *   - notes: one point per `study_notes` row the user created.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** pg returns aggregates as strings/Dates/null — coerce defensively. */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * The cumulative progress score for one user. Cached per request.
 */
export const getProgressScore = cache(
  async (userId: string): Promise<ProgressScore> => {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

    // One aggregate query per source: lifetime count, last-7-days count, and
    // the most recent timestamp — all userId-scoped.
    const [interviewRows, dojoRows, noteRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          recent: sql<number>`count(*) filter (where ${sessionQuestions.answeredAt} >= ${cutoff})`,
          lastAt: sql<Date | null>`max(${sessionQuestions.answeredAt})`,
        })
        .from(sessionQuestions)
        .innerJoin(
          interviewSessions,
          eq(interviewSessions.id, sessionQuestions.sessionId),
        )
        .where(
          and(
            eq(interviewSessions.userId, userId),
            isNotNull(interviewSessions.scoredAt),
            isNotNull(sessionQuestions.answeredAt),
          ),
        ),
      db
        .select({
          total: sql<number>`count(*)`,
          recent: sql<number>`count(*) filter (where ${dojoProgress.solvedAt} >= ${cutoff})`,
          lastAt: sql<Date | null>`max(${dojoProgress.solvedAt})`,
        })
        .from(dojoProgress)
        .where(
          and(eq(dojoProgress.userId, userId), eq(dojoProgress.solved, true)),
        ),
      db
        .select({
          total: sql<number>`count(*)`,
          recent: sql<number>`count(*) filter (where ${studyNotes.createdAt} >= ${cutoff})`,
          lastAt: sql<Date | null>`max(${studyNotes.createdAt})`,
        })
        .from(studyNotes)
        .where(eq(studyNotes.userId, userId)),
    ]);

    const interviews = num(interviewRows[0]?.total);
    const dojo = num(dojoRows[0]?.total);
    const notes = num(noteRows[0]?.total);

    const bySource = {
      interviews: { count: interviews, points: interviews * POINTS.interviews },
      dojo: { count: dojo, points: dojo * POINTS.dojo },
      notes: { count: notes, points: notes * POINTS.notes },
    };

    const total =
      bySource.interviews.points + bySource.dojo.points + bySource.notes.points;

    const last7days =
      num(interviewRows[0]?.recent) * POINTS.interviews +
      num(dojoRows[0]?.recent) * POINTS.dojo +
      num(noteRows[0]?.recent) * POINTS.notes;

    // Most recent point-earning event across the three sources.
    const events: { source: ProgressSource; points: number; at: Date }[] = [];
    const pushEvent = (
      source: ProgressSource,
      points: number,
      raw: unknown,
    ) => {
      const at = toDate(raw);
      if (at) events.push({ source, points, at });
    };
    pushEvent("interviews", POINTS.interviews, interviewRows[0]?.lastAt);
    pushEvent("dojo", POINTS.dojo, dojoRows[0]?.lastAt);
    pushEvent("notes", POINTS.notes, noteRows[0]?.lastAt);

    const lastEarned =
      events.length === 0
        ? null
        : events.reduce((latest, c) =>
            c.at.getTime() > latest.at.getTime() ? c : latest,
          );

    return progressScoreSchema.parse({
      total,
      bySource,
      last7days,
      lastEarned,
    });
  },
);

/**
 * Cheapest possible "what to practice next" hint: the tech stack with the
 * lowest average score across the user's scored interviews. Pure aggregation —
 * deliberately does NOT call `getGapAnalysis` (which spends an AI call). Returns
 * null when the user has no scored interviews yet. Cached per request.
 */
export const getWeakestSpecialization = cache(
  async (userId: string): Promise<string | null> => {
    const [row] = await db
      .select({
        name: techStacks.name,
        avg: sql<
          number | null
        >`avg(${interviewSessions.totalScore} * 100.0 / nullif(${interviewSessions.maxScore}, 0))`,
      })
      .from(interviewSessions)
      .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
      .where(
        and(
          eq(interviewSessions.userId, userId),
          isNotNull(interviewSessions.scoredAt),
        ),
      )
      .groupBy(techStacks.name)
      .having(
        sql`avg(${interviewSessions.totalScore} * 100.0 / nullif(${interviewSessions.maxScore}, 0)) is not null`,
      )
      .orderBy(
        asc(
          sql`avg(${interviewSessions.totalScore} * 100.0 / nullif(${interviewSessions.maxScore}, 0))`,
        ),
      )
      .limit(1);

    return row?.name ?? null;
  },
);
