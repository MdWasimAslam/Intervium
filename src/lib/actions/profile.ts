"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, jobRoles, profiles } from "@db";
import { getCurrentUser } from "@/lib/session";
import type { OnboardingDraft } from "@/lib/actions/onboarding";

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Profile-edit fields. These mirror the onboarding field rules exactly — the
 * /profile screen is a different *UI* over the same data, not new behaviour.
 * Every field is optional so a section can be saved on its own.
 */
const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1, "Display name is required.").max(80),
    primaryRoleId: z.string().uuid("Pick a role."),
    yearsExperience: z.number().int().min(0).max(60),
    skills: z.array(z.string().trim().min(1).max(60)).max(50),
    cvText: z.string().max(20000),
  })
  .partial();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export interface ProfileResult {
  ok: boolean;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Action                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Update one or more profile fields for the signed-in user.
 *
 * Writes the same `profiles` columns onboarding does and keeps the onboarding
 * draft echo in sync (so re-opening the wizard shows the latest values), using
 * the same per-field validation. Unlike `completeOnboarding` it does not
 * redirect — it returns a result so the editor can show inline save state.
 */
export async function updateProfile(
  input: ProfileUpdate,
): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) return { ok: true };

  // A provided role must exist (admin-managed data) — same check as completion.
  if (data.primaryRoleId !== undefined) {
    const [role] = await db
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(eq(jobRoles.id, data.primaryRoleId));
    if (!role) {
      return { ok: false, error: "Selected role is no longer available." };
    }
  }

  try {
    // Read the existing draft so the wizard's edit view stays consistent.
    const [row] = await db
      .select({ onboarding: profiles.onboarding })
      .from(profiles)
      .where(eq(profiles.userId, user.id));
    const onboarding = { ...((row?.onboarding ?? {}) as OnboardingDraft) };

    // Mirror echoed fields. cvText is intentionally kept out of the draft echo,
    // matching `completeOnboarding` — it lives only in its column.
    if (data.displayName !== undefined) onboarding.displayName = data.displayName;
    if (data.primaryRoleId !== undefined)
      onboarding.primaryRoleId = data.primaryRoleId;
    if (data.yearsExperience !== undefined)
      onboarding.yearsExperience = data.yearsExperience;
    if (data.skills !== undefined) onboarding.skills = data.skills;

    const set: Partial<typeof profiles.$inferInsert> = {
      onboarding,
      updatedAt: new Date(),
    };
    if (data.displayName !== undefined) set.displayName = data.displayName;
    if (data.primaryRoleId !== undefined) set.primaryRole = data.primaryRoleId;
    if (data.yearsExperience !== undefined)
      set.yearsExperience = data.yearsExperience;
    if (data.skills !== undefined) set.skills = data.skills;
    if (data.cvText !== undefined) set.cvText = data.cvText ? data.cvText : null;

    await db.update(profiles).set(set).where(eq(profiles.userId, user.id));

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return { ok: true };
  } catch (error) {
    console.error("[profile:update]", error);
    return { ok: false, error: "Could not save your changes." };
  }
}
