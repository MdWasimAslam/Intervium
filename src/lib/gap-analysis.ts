import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, interviewSessions, profiles, techStacks } from "@db";
import { analyzeSkillGap, type GapReport } from "@/lib/groq";
import { reserveAiCalls } from "@/lib/ai-budget";

export interface TestedSpecialization {
  name: string;
  /** Average score percentage (0-100) across scored sessions. */
  avgScore: number;
  sessionCount: number;
}

export interface GapAnalysis {
  /** False when the user has no scored interviews yet. */
  hasData: boolean;
  resumeSkills: string[];
  tested: TestedSpecialization[];
  /** AI-generated report; null when there's no data or AI is unavailable. */
  report: GapReport | null;
  /** A user-facing note when the report is absent (e.g. budget/insufficient). */
  note?: string;
}

/**
 * Resume-vs-Interview gap analysis (Feature 3). Aggregates demonstrated
 * interview performance per specialization from existing tables, pairs it with
 * the user's claimed skills, and asks Groq for a grounded gap report + learning
 * path. Pure aggregation + one AI call — no new schema, no persisted state.
 */
export async function getGapAnalysis(userId: string): Promise<GapAnalysis> {
  const [profile] = await db
    .select({ skills: profiles.skills })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  const resumeSkills = Array.isArray(profile?.skills)
    ? (profile.skills as string[])
    : [];

  // Per-specialization average score over the user's scored sessions.
  const rows = await db
    .select({
      name: techStacks.name,
      avg: sql<
        number | null
      >`avg(${interviewSessions.totalScore} * 100.0 / nullif(${interviewSessions.maxScore}, 0))`,
      n: sql<number>`count(*)::int`,
    })
    .from(interviewSessions)
    .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
    .where(
      and(
        eq(interviewSessions.userId, userId),
        isNotNull(interviewSessions.scoredAt),
      ),
    )
    .groupBy(techStacks.name);

  const tested: TestedSpecialization[] = rows
    .filter((r) => r.avg != null)
    .map((r) => ({
      name: r.name,
      avgScore: Math.round(Number(r.avg)),
      sessionCount: Number(r.n),
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  if (tested.length === 0) {
    return {
      hasData: false,
      resumeSkills,
      tested: [],
      report: null,
      note: "Complete at least one scored interview to unlock your gap analysis.",
    };
  }

  let report: GapReport | null = null;
  let note: string | undefined;
  if (await reserveAiCalls(1)) {
    try {
      report = await analyzeSkillGap({ resumeSkills, tested }, userId);
    } catch (error) {
      console.warn("[gap-analysis] AI report failed:", error);
      note =
        "We couldn't generate the AI insights right now — your performance data is shown below.";
    }
  } else {
    note =
      "AI insights are paused (today's limit reached). Your performance data is shown below.";
  }

  return { hasData: true, resumeSkills, tested, report, note };
}
