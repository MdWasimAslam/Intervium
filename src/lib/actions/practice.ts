"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  focusAreas,
  interviewSessions,
  jobRoles,
  questionsCache,
  sessionQuestions,
  techStacks,
} from "@db";
import { withTransaction } from "@db/tx";
import { getCurrentUser } from "@/lib/session";
import { getRetryQuestionIds } from "@/lib/insights";

/** Questions served when practising a weak area (the engine tops up if short). */
const PRACTICE_QUESTION_COUNT = 5;

/* -------------------------------------------------------------------------- */
/* (a) Practice a weak area                                                   */
/* -------------------------------------------------------------------------- */

const practiceAreaSchema = z.object({
  jobRoleId: z.string().uuid(),
  techStackId: z.string().uuid(),
  focusAreaId: z.string().uuid(),
  difficulty: z.string().trim().min(1).max(40),
});

export type PracticeAreaInput = z.infer<typeof practiceAreaSchema>;

/**
 * Start a fresh interview pre-configured to a weak area. Mirrors the validation
 * in `startInterview` (role active, focus/stack belong to the role) and then
 * hands off to the normal session + question-engine flow.
 */
export async function practiceWeakArea(
  input: PracticeAreaInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const parsed = practiceAreaSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid practice configuration." };
  const config = parsed.data;

  const [role] = await db
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(and(eq(jobRoles.id, config.jobRoleId), eq(jobRoles.isActive, true)));
  if (!role) return { error: "That role is no longer available." };

  const [focus] = await db
    .select({ id: focusAreas.id })
    .from(focusAreas)
    .where(
      and(
        eq(focusAreas.id, config.focusAreaId),
        eq(focusAreas.jobRoleId, config.jobRoleId),
        eq(focusAreas.isActive, true),
      ),
    );
  if (!focus) return { error: "That focus area is no longer available." };

  const [stack] = await db
    .select({ id: techStacks.id })
    .from(techStacks)
    .where(
      and(
        eq(techStacks.id, config.techStackId),
        eq(techStacks.jobRoleId, config.jobRoleId),
        eq(techStacks.isActive, true),
      ),
    );
  if (!stack) return { error: "That tech stack is no longer available." };

  let sessionId: string;
  try {
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: user.id,
        jobRoleId: config.jobRoleId,
        techStackId: config.techStackId,
        focusAreaId: config.focusAreaId,
        interviewType: "technical",
        difficulty: config.difficulty,
        questionCount: PRACTICE_QUESTION_COUNT,
        timerEnabled: false,
        status: "in_progress",
      })
      .returning({ id: interviewSessions.id });
    sessionId = session.id;
  } catch (error) {
    console.error("[practiceWeakArea]", error);
    return { error: "Could not start practice. Please try again." };
  }

  redirect(`/interview/${sessionId}`);
}

/* -------------------------------------------------------------------------- */
/* (b) Retry your weakest answers                                             */
/* -------------------------------------------------------------------------- */

/**
 * Build a fresh session from the specific questions the user scored lowest on.
 * The questions are resolved server-side (never trusting client ids) and the
 * `session_questions` rows are written directly, so the existing interview page
 * replays exactly these questions — no generation, no AI. Prior attempts stay
 * untouched, so this counts as a brand-new attempt.
 */
export async function retryWeakAnswers(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const questionIds = await getRetryQuestionIds(user.id);
  if (questionIds.length === 0) {
    return { error: "No weak answers to retry right now." };
  }

  // Pull each question's config so we can stamp a representative (consistent)
  // config onto the session for its NOT NULL columns + scoring context.
  const rows = await db
    .select({
      id: questionsCache.id,
      jobRoleId: questionsCache.jobRoleId,
      techStackId: questionsCache.techStackId,
      focusAreaId: questionsCache.focusAreaId,
      difficulty: questionsCache.difficulty,
    })
    .from(questionsCache)
    .where(inArray(questionsCache.id, questionIds));

  if (rows.length === 0) return { error: "Could not load your weak answers." };

  // Most common full config tuple → a coherent set of references.
  const tally = new Map<string, { row: (typeof rows)[number]; n: number }>();
  for (const r of rows) {
    const key = `${r.jobRoleId}|${r.techStackId}|${r.focusAreaId}|${r.difficulty}`;
    const entry = tally.get(key);
    if (entry) entry.n++;
    else tally.set(key, { row: r, n: 1 });
  }
  const dominant = [...tally.values()].sort((a, b) => b.n - a.n)[0].row;

  // Preserve the "worst first" ordering returned by getRetryQuestionIds.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = questionIds.filter((id) => byId.has(id));

  let sessionId: string;
  try {
    // Both inserts must succeed together — otherwise an orphaned empty session
    // (no questions) would persist and break the interview page.
    sessionId = await withTransaction(async (tx) => {
      const [session] = await tx
        .insert(interviewSessions)
        .values({
          userId: user.id,
          jobRoleId: dominant.jobRoleId,
          techStackId: dominant.techStackId,
          focusAreaId: dominant.focusAreaId,
          interviewType: "mixed",
          difficulty: dominant.difficulty,
          questionCount: ordered.length,
          timerEnabled: false,
          status: "in_progress",
        })
        .returning({ id: interviewSessions.id });

      await tx.insert(sessionQuestions).values(
        ordered.map((questionId, position) => ({
          sessionId: session.id,
          questionId,
          position,
        })),
      );
      return session.id;
    });
  } catch (error) {
    console.error("[retryWeakAnswers]", error);
    return { error: "Could not start your retry session. Please try again." };
  }

  redirect(`/interview/${sessionId}`);
}
