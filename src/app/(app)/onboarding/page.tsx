import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, difficultyBands, jobRoles, profiles, techStacks } from "@db";
import { requireAuth } from "@/lib/session";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import type { OnboardingDraft } from "@/lib/actions/onboarding";
import type { WizardValues } from "@/components/onboarding/types";

export const metadata: Metadata = { title: "Onboarding" };

/**
 * Onboarding wizard host (Server Component).
 * Loads admin-managed reference data + the saved draft, and redirects users
 * who have already finished onboarding to the dashboard.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireAuth();
  const { edit } = await searchParams;
  // `?edit=1` lets an already-onboarded user revisit the wizard to update their
  // profile. Without it, finished users are bounced to the dashboard as before.
  const editing = edit === "1" || edit === "true";

  const [profile] = await db
    .select({ onboarding: profiles.onboarding })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  const draft = (profile?.onboarding ?? {}) as OnboardingDraft;
  if (draft.completed === true && !editing) redirect("/dashboard");

  // Reference data — all from the DB, never hardcoded.
  const [roles, stacks, bands] = await Promise.all([
    db
      .select({
        id: jobRoles.id,
        name: jobRoles.name,
        description: jobRoles.description,
      })
      .from(jobRoles)
      .where(eq(jobRoles.isActive, true))
      .orderBy(asc(jobRoles.sortOrder)),
    db
      .select({
        id: techStacks.id,
        jobRoleId: techStacks.jobRoleId,
        name: techStacks.name,
      })
      .from(techStacks)
      .where(eq(techStacks.isActive, true)),
    db
      .select({
        jobRoleId: difficultyBands.jobRoleId,
        label: difficultyBands.label,
        minYears: difficultyBands.minYears,
        maxYears: difficultyBands.maxYears,
      })
      .from(difficultyBands),
  ]);

  const initialValues: WizardValues = {
    displayName: draft.displayName ?? "",
    primaryRoleId: draft.primaryRoleId ?? "",
    yearsExperience: draft.yearsExperience ?? 0,
    skills: draft.skills ?? [],
    targetRole: draft.targetRole ?? "",
    interviewStyle: draft.interviewStyle ?? "",
    cvText: draft.cvText ?? "",
  };

  // Resume on the saved step, clamped to a real step index (0–7).
  const initialStep = Math.min(Math.max(draft.step ?? 0, 0), 7);

  return (
    <OnboardingWizard
      roles={roles}
      stacks={stacks}
      bands={bands}
      initialValues={initialValues}
      initialStep={initialStep}
    />
  );
}
