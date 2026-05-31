"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, jobRoles, profiles } from "@db";
import { getCurrentUser } from "@/lib/session";

/* -------------------------------------------------------------------------- */
/* Schemas                                                                    */
/* -------------------------------------------------------------------------- */

const INTERVIEW_STYLES = ["text", "voice", "both"] as const;

/** Per-field rules. Used partially for step saves, fully for completion. */
const fieldSchema = {
  displayName: z.string().trim().min(1, "Display name is required.").max(80),
  primaryRoleId: z.string().uuid("Pick a role."),
  yearsExperience: z.number().int().min(0).max(60),
  skills: z.array(z.string().trim().min(1).max(60)).max(50),
  targetRole: z.string().trim().max(200),
  interviewStyle: z.enum(INTERVIEW_STYLES),
  cvText: z.string().max(20000),
};

const draftSchema = z.object(fieldSchema).partial();

const completeSchema = z.object({
  displayName: fieldSchema.displayName,
  primaryRoleId: fieldSchema.primaryRoleId,
  yearsExperience: fieldSchema.yearsExperience,
  skills: fieldSchema.skills.default([]),
  targetRole: fieldSchema.targetRole.default(""),
  interviewStyle: fieldSchema.interviewStyle,
  cvText: fieldSchema.cvText.default(""),
});

export type OnboardingDraft = z.infer<typeof draftSchema> & {
  step?: number;
  completed?: boolean;
};

export interface StepResult {
  ok: boolean;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Read the current onboarding draft for a user (or empty). */
async function readDraft(userId: string): Promise<OnboardingDraft> {
  const [profile] = await db
    .select({ onboarding: profiles.onboarding })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return (profile?.onboarding ?? {}) as OnboardingDraft;
}

/** Upsert the merged onboarding draft for a user. */
async function writeDraft(userId: string, onboarding: OnboardingDraft) {
  await db
    .insert(profiles)
    .values({ userId, onboarding })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { onboarding, updatedAt: new Date() },
    });
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Persist a single step's answer into `profiles.onboarding` (jsonb draft) so
 * progress survives a refresh. `nextStep` records where to resume.
 */
export async function saveOnboardingStep(
  partial: Partial<OnboardingDraft>,
  nextStep: number,
): Promise<StepResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = draftSchema.safeParse(partial);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const current = await readDraft(user.id);
    await writeDraft(user.id, {
      ...current,
      ...parsed.data,
      step: nextStep,
    });
    return { ok: true };
  } catch (error) {
    console.error("[onboarding:saveStep]", error);
    return { ok: false, error: "Could not save your progress." };
  }
}

/**
 * Finalise onboarding: validate everything, write the structured columns,
 * mark the draft completed, and redirect to the dashboard.
 */
export async function completeOnboarding(data: unknown): Promise<StepResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = completeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please complete all steps.",
    };
  }
  const input = parsed.data;

  // The chosen role must exist and be active (admin-managed data).
  const [role] = await db
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(
      and(eq(jobRoles.id, input.primaryRoleId), eq(jobRoles.isActive, true)),
    );
  if (!role) {
    return { ok: false, error: "Selected role is no longer available." };
  }

  try {
    const current = await readDraft(user.id);
    const onboarding: OnboardingDraft = {
      ...current,
      displayName: input.displayName,
      primaryRoleId: input.primaryRoleId,
      yearsExperience: input.yearsExperience,
      skills: input.skills,
      targetRole: input.targetRole,
      interviewStyle: input.interviewStyle,
      // cvText is intentionally kept out of the draft echo; it lives in its column.
      completed: true,
    };

    await db
      .insert(profiles)
      .values({
        userId: user.id,
        displayName: input.displayName,
        primaryRole: input.primaryRoleId,
        yearsExperience: input.yearsExperience,
        skills: input.skills,
        cvText: input.cvText ? input.cvText : null,
        onboarding,
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: {
          displayName: input.displayName,
          primaryRole: input.primaryRoleId,
          yearsExperience: input.yearsExperience,
          skills: input.skills,
          cvText: input.cvText ? input.cvText : null,
          onboarding,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[onboarding:complete]", error);
    return { ok: false, error: "Could not complete onboarding." };
  }

  redirect("/dashboard");
}
