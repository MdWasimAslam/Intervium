"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  interviewSessions,
  jobRoles,
  sessionQuestions,
  techStacks,
} from "@db";
import { getCurrentUser } from "@/lib/session";
import {
  CUSTOM_TIMER_ID,
  getSettings,
  questionCountForPreset,
  timerSecondsForPreset,
} from "@/lib/settings";
import { allowAction } from "@/lib/rate-limit";

const startSchema = z
  .object({
    mode: z.enum(["bank", "ai"]),
    jobRoleId: z.string().uuid(),
    techStackId: z.string().uuid(),
    // AI mode only — the calibration target for live generation.
    skillLevel: z
      .enum(["beginner", "intermediate", "advanced", "expert"])
      .optional(),
    // Preset choices; resolved to a question count / timer seconds at action
    // time against the admin-configured presets.
    lengthPresetId: z.string().trim().min(1),
    timerPresetId: z.string().trim().min(1),
    // Only meaningful when timerPresetId === "custom".
    customTimerSeconds: z.coerce.number().int().min(5).max(7200).optional(),
  })
  .refine((d) => d.mode !== "ai" || !!d.skillLevel, {
    message: "Pick a skill level for an AI interview.",
    path: ["skillLevel"],
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

  // Resolve the preset choices against the admin-configured presets.
  const settings = await getSettings();
  const questionCount = questionCountForPreset(settings, config.lengthPresetId);
  if (!questionCount) {
    return { error: "Invalid interview length." };
  }

  const isCustomTimer = config.timerPresetId === CUSTOM_TIMER_ID;
  const timerKnown =
    isCustomTimer ||
    settings.timerPresets.some((t) => t.id === config.timerPresetId);
  if (!timerKnown) {
    return { error: "Invalid timer option." };
  }
  if (isCustomTimer && !config.customTimerSeconds) {
    return { error: "Enter a custom timer duration." };
  }
  const timerSeconds = timerSecondsForPreset(
    settings,
    config.timerPresetId,
    config.customTimerSeconds,
  );
  const timerEnabled = timerSeconds != null && timerSeconds > 0;

  // Validate the referenced rows exist, are active, and belong to the role.
  const [role] = await db
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(and(eq(jobRoles.id, config.jobRoleId), eq(jobRoles.isActive, true)));
  if (!role) return { error: "Selected profession is unavailable." };

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
  if (!stack)
    return { error: "Specialization does not match the selected profession." };

  // Don't accumulate dangling in-progress sessions: a user can only have one
  // live interview at a time. Close any existing in-progress sessions before
  // starting a new one. This is non-destructive — answers/feedback are kept,
  // the session just moves to "completed" (the only other status available).
  await db
    .update(interviewSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(
      and(
        eq(interviewSessions.userId, user.id),
        eq(interviewSessions.status, "in_progress"),
      ),
    );

  let sessionId: string;
  try {
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: user.id,
        mode: config.mode,
        jobRoleId: config.jobRoleId,
        techStackId: config.techStackId,
        // Skill level applies to AI interviews only.
        skillLevel: config.mode === "ai" ? config.skillLevel : null,
        questionCount,
        timerEnabled,
        timerPresetId: config.timerPresetId,
        // Snapshot the resolved seconds (null = no timer) so a later admin edit
        // to the presets can't retroactively change this in-progress session.
        customTimerSeconds: timerSeconds,
        lengthPresetId: config.lengthPresetId,
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
  const { sessionId, position, answer, timeTaken } = parsed.data;

  const session = await loadOwnedSession(sessionId, user.id);
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "completed") {
    return { ok: false, error: "This interview is already completed." };
  }

  try {
    const result = await db
      .update(sessionQuestions)
      .set({
        userAnswer: answer,
        timeTakenSeconds: timeTaken,
        answeredAt: new Date(),
      })
      .where(
        and(
          eq(sessionQuestions.sessionId, sessionId),
          eq(sessionQuestions.position, position),
        ),
      );
    // No row at this (session, position) means the question doesn't exist —
    // don't report a phantom success.
    if (result.rowCount === 0) {
      return { ok: false, error: "Question not found for this session." };
    }
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
    // The session now appears (and its stats change) on these surfaces, which
    // are otherwise served from the client router cache until a hard reload.
    revalidatePath("/dashboard");
    revalidatePath("/history");
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

  // Single-flight per session: stops two open tabs from both kicking off
  // scoring and double-spending the AI budget on the same session. scoreSession
  // is itself idempotent; this just avoids the wasted concurrent batch. The
  // window is short so it covers the on-load race without blocking a manual
  // "Try again" after a budget error.
  const SCORING_LOCK_MS = 3_000;
  if (!allowAction(`score-lock:${parsed.data}`, 1, SCORING_LOCK_MS)) {
    return {
      ok: false,
      error: "Scoring is already in progress — refresh in a moment.",
    };
  }

  try {
    const { scoreSession } = await import("@/lib/scoring");
    await scoreSession(parsed.data);
    // The freshly-scored session changes the dashboard, history and results.
    revalidatePath("/dashboard");
    revalidatePath("/history");
    revalidatePath(`/interview/${parsed.data}/results`);
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
      mode: interviewSessions.mode,
      jobRoleId: interviewSessions.jobRoleId,
      techStackId: interviewSessions.techStackId,
      skillLevel: interviewSessions.skillLevel,
      questionCount: interviewSessions.questionCount,
      timerEnabled: interviewSessions.timerEnabled,
      timerPresetId: interviewSessions.timerPresetId,
      customTimerSeconds: interviewSessions.customTimerSeconds,
      lengthPresetId: interviewSessions.lengthPresetId,
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
