import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  interviewSessions,
  jobRoles,
  profiles,
  techStacks,
} from "@db";
import { requireAuth } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/layout/Container";
import { InterviewSetup } from "@/components/interview/InterviewSetup";
import {
  LatestResult,
  type LatestSession,
} from "@/components/interview/LatestResult";

export const metadata: Metadata = { title: "New interview" };

/** Sensible default skill level for the AI interview, from profile years. */
function skillFromYears(
  years: number,
): "beginner" | "intermediate" | "advanced" | "expert" {
  if (years <= 1) return "beginner";
  if (years <= 3) return "intermediate";
  if (years <= 5) return "advanced";
  return "expert";
}

/**
 * Interview setup screen (Server Component).
 * Loads all dropdown data from the DB and the user's latest completed session.
 */
export default async function NewInterviewPage() {
  const user = await requireAuth();

  const [profile] = await db
    .select({
      primaryRole: profiles.primaryRole,
      yearsExperience: profiles.yearsExperience,
      onboarding: profiles.onboarding,
    })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  // New users must finish onboarding before starting interviews.
  const onboarding = (profile?.onboarding ?? {}) as { completed?: boolean };
  if (!onboarding.completed) redirect("/onboarding");

  // Fetch all setup data — including settings — in one concurrent batch.
  const [roles, stacks, latestRows, settings] = await Promise.all([
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
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
        totalScore: interviewSessions.totalScore,
        maxScore: interviewSessions.maxScore,
        mode: interviewSessions.mode,
        techStack: techStacks.name,
      })
      .from(interviewSessions)
      .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
      .where(
        and(
          eq(interviewSessions.userId, user.id),
          eq(interviewSessions.status, "completed"),
          isNotNull(interviewSessions.scoredAt),
        ),
      )
      .orderBy(desc(interviewSessions.scoredAt))
      .limit(1),
    getSettings(),
  ]);

  const defaultRoleId =
    roles.find((r) => r.id === profile?.primaryRole)?.id ?? roles[0]?.id ?? "";
  const latest: LatestSession | null = latestRows[0] ?? null;

  return (
    <Container className="py-10">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InterviewSetup
            roles={roles}
            techStacks={stacks}
            defaultRoleId={defaultRoleId}
            defaultSkillLevel={skillFromYears(profile?.yearsExperience ?? 0)}
            timerPresets={settings.timerPresets}
            defaultTimerPresetId={settings.defaultTimerPresetId}
            lengthPresets={settings.lengthPresets}
            defaultLengthPresetId={settings.defaultLengthPresetId}
          />
        </div>
        <div>
          <LatestResult latest={latest} />
        </div>
      </div>
    </Container>
  );
}
