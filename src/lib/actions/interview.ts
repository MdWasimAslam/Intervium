"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  focusAreas,
  interviewSessions,
  jobRoles,
  sessionQuestions,
  techStacks,
} from "@db";
import { getCurrentUser } from "@/lib/session";
import { allowAction } from "@/lib/rate-limit";

const startSchema = z.object({
  jobRoleId: z.string().uuid(),
  interviewType: z.enum(["technical", "behavioral", "mixed", "coding"]),
  difficulty: z.string().trim().min(1).max(40),
  focusAreaId: z.string().uuid(),
  techStackId: z.string().uuid(),
  questionCount: z.coerce
    .number()
    .int()
    .refine((v) => [3, 5, 10].includes(v), "Invalid question count."),
  timerEnabled: z.boolean(),
  mode: z.enum(["text", "voice"]),
});

export type StartInterviewInput = z.infer<typeof startSchema>;

export interface StartResult {
  error: string;
}

/**
 * Validate the interview configuration, create an `interview_sessions` row,
 * and redirect to the session page. Returns a `{ error }` only on failure
 * (success redirects and never returns).
 */
export async function startInterview(
  input: StartInterviewInput,
): Promise<StartResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid configuration.",
    };
  }
  const config = parsed.data;

  // Validate the referenced rows exist, are active, and belong to the role.
  const [role] = await db
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(and(eq(jobRoles.id, config.jobRoleId), eq(jobRoles.isActive, true)));
  if (!role) return { error: "Selected role is unavailable." };

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
  if (!focus) return { error: "Focus area does not match the selected role." };

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
  if (!stack) return { error: "Tech stack does not match the selected role." };

  let sessionId: string;
  try {
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: user.id,
        jobRoleId: config.jobRoleId,
        techStackId: config.techStackId,
        focusAreaId: config.focusAreaId,
        interviewType: config.interviewType,
        difficulty: config.difficulty,
        questionCount: config.questionCount,
        mode: config.mode,
        timerEnabled: config.timerEnabled,
        status: "in_progress",
      })
      .returning({ id: interviewSessions.id });
    sessionId = session.id;
  } catch (error) {
    console.error("[startInterview]", error);
    return { error: "Could not start the interview. Please try again." };
  }

  redirect(`/interview/${sessionId}`);
}

/* -------------------------------------------------------------------------- */
/* Answering (Phase 7)                                                        */
/* -------------------------------------------------------------------------- */

const saveAnswerSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
  answer: z.string().max(20000),
  timeTaken: z.number().int().min(0).max(100000),
  // For voice mode: the raw transcript. Mirrored into user_answer by the
  // caller so the Phase 8 scorer needs no changes.
  transcript: z.string().max(20000).optional(),
});

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

export interface SaveAnswerResult {
  ok: boolean;
  error?: string;
}

/** Owner + status check for a session. Returns the row or null. */
async function loadOwnedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select({
      id: interviewSessions.id,
      userId: interviewSessions.userId,
      status: interviewSessions.status,
    })
    .from(interviewSessions)
    .where(eq(interviewSessions.id, sessionId));
  if (!session || session.userId !== userId) return null;
  return session;
}

/**
 * Persist a single answer onto its existing session_questions row,
 * matched by (session_id, position). Sets answered_at.
 */
export async function saveAnswer(
  input: SaveAnswerInput,
): Promise<SaveAnswerResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid answer payload." };
  const { sessionId, position, answer, timeTaken, transcript } = parsed.data;

  const session = await loadOwnedSession(sessionId, user.id);
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "completed") {
    return { ok: false, error: "This interview is already completed." };
  }

  try {
    await db
      .update(sessionQuestions)
      .set({
        userAnswer: answer,
        timeTakenSeconds: timeTaken,
        answeredAt: new Date(),
        // Only set transcript for voice; leave it untouched for text.
        ...(transcript !== undefined ? { transcript } : {}),
      })
      .where(
        and(
          eq(sessionQuestions.sessionId, sessionId),
          eq(sessionQuestions.position, position),
        ),
      );
    return { ok: true };
  } catch (error) {
    console.error("[saveAnswer]", error);
    return { ok: false, error: "Could not save your answer." };
  }
}

/**
 * Mark a session completed and redirect to its results page.
 * Scoring stays at 0 — Phase 8 fills it.
 */
export async function completeSession(input: {
  sessionId: string;
}): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const sessionId = z.string().uuid().safeParse(input.sessionId);
  if (!sessionId.success) return { error: "Invalid session." };

  const session = await loadOwnedSession(sessionId.data, user.id);
  if (!session) return { error: "Session not found." };

  if (session.status !== "completed") {
    await db
      .update(interviewSessions)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(interviewSessions.id, sessionId.data));
  }

  redirect(`/interview/${sessionId.data}/results`);
}

/* -------------------------------------------------------------------------- */
/* Scoring + retake (Phase 8)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Trigger scoring for a session the caller owns. Idempotent (scoreSession
 * skips already-scored work). Returns { ok } so the client can refresh.
 */
export async function scoreSessionAction(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = z.string().uuid().safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "Invalid session." };

  const session = await loadOwnedSession(parsed.data, user.id);
  if (!session) return { ok: false, error: "Session not found." };

  if (!allowAction(`score:${user.id}`, 20, 60_000)) {
    return {
      ok: false,
      error: "You're scoring too often. Please wait a moment and try again.",
    };
  }

  try {
    const { scoreSession } = await import("@/lib/scoring");
    await scoreSession(parsed.data);
    return { ok: true };
  } catch (error) {
    const { AiBudgetError } = await import("@/lib/ai-budget");
    if (error instanceof AiBudgetError) {
      // Budget spent for today — the session stays unscored so it can be
      // retried later. Surface the friendly message, not a hard failure.
      return { ok: false, error: error.message };
    }
    console.error("[scoreSessionAction]", error);
    return { ok: false, error: "Scoring failed. Please try again." };
  }
}

/**
 * Create a new in-progress session with the same config as an existing one
 * (Retake), then redirect to it.
 */
export async function retakeSession(input: {
  sessionId: string;
}): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const parsed = z.string().uuid().safeParse(input.sessionId);
  if (!parsed.success) return { error: "Invalid session." };

  const [src] = await db
    .select({
      userId: interviewSessions.userId,
      jobRoleId: interviewSessions.jobRoleId,
      techStackId: interviewSessions.techStackId,
      focusAreaId: interviewSessions.focusAreaId,
      interviewType: interviewSessions.interviewType,
      difficulty: interviewSessions.difficulty,
      questionCount: interviewSessions.questionCount,
      mode: interviewSessions.mode,
      timerEnabled: interviewSessions.timerEnabled,
    })
    .from(interviewSessions)
    .where(eq(interviewSessions.id, parsed.data));

  if (!src || src.userId !== user.id) return { error: "Session not found." };

  let newId: string;
  try {
    const [created] = await db
      .insert(interviewSessions)
      .values({ ...src, status: "in_progress" })
      .returning({ id: interviewSessions.id });
    newId = created.id;
  } catch (error) {
    console.error("[retakeSession]", error);
    return { error: "Could not start a new interview." };
  }

  redirect(`/interview/${newId}`);
}
