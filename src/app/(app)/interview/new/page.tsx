import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  difficultyBands,
  focusAreas,
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

  const [roles, focuses, stacks, bands, latestRows] = await Promise.all([
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .where(eq(jobRoles.isActive, true))
      .orderBy(asc(jobRoles.sortOrder)),
    db
      .select({
        id: focusAreas.id,
        jobRoleId: focusAreas.jobRoleId,
        name: focusAreas.name,
      })
      .from(focusAreas)
      .where(eq(focusAreas.isActive, true)),
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
    db
      .select({
        totalScore: interviewSessions.totalScore,
        maxScore: interviewSessions.maxScore,
        interviewType: interviewSessions.interviewType,
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
  ]);

  const defaultRoleId =
    roles.find((r) => r.id === profile?.primaryRole)?.id ?? roles[0]?.id ?? "";
  const latest: LatestSession | null = latestRows[0] ?? null;
  const settings = await getSettings();

  return (
    <Container className="py-10">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InterviewSetup
            roles={roles}
            focusAreas={focuses}
            techStacks={stacks}
            bands={bands}
            defaultRoleId={defaultRoleId}
            defaultYears={profile?.yearsExperience ?? 0}
            questionCounts={settings.questionCounts}
            timerSeconds={settings.defaultTimerSeconds}
          />
        </div>
        <div>
          <LatestResult latest={latest} />
        </div>
      </div>
    </Container>
  );
}
