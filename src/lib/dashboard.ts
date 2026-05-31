import "server-only";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  difficultyBands,
  interviewSessions,
  jobRoles,
  profiles,
  sessionQuestions,
  techStacks,
} from "@db";

/**
 * Read-only dashboard data layer.
 *
 * Everything here is *derived* from existing tables — profiles,
 * interview_sessions, session_questions, job_roles, tech_stacks,
 * difficulty_bands. No new columns, no AI calls, no invented values.
 */

export interface DashboardProfile {
  /** Stable seed for the user's generated avatar. */
  userId: string;
  displayName: string;
  roleName: string | null;
  yearsExperience: number;
  band: string | null;
  skills: string[];
  hasCv: boolean;
}

export interface DashboardStats {
  /** Sessions with status = "completed". */
  completed: number;
  /** Mean of per-session score percentages (scored sessions only), or null. */
  avgPct: number | null;
  /** Highest single-session score percentage, or null. */
  bestPct: number | null;
  /** Count of session_questions that have been answered. */
  questionsAnswered: number;
}

export interface RecentSession {
  id: string;
  role: string;
  tech: string;
  interviewType: string;
  totalScore: number;
  maxScore: number;
  pct: number;
  date: string;
}

export interface DashboardStreaks {
  /** Consecutive days practised, counting back from today (UTC). */
  current: number;
  /** Longest consecutive-day run ever. */
  longest: number;
  /** Interviews started in the last 7 days. */
  thisWeek: number;
  /** Whether a session was started today (UTC) — drives the "active" flame. */
  activeToday: boolean;
}

export interface DashboardMilestone {
  /** The most recent scored session set a new personal best. */
  isNewBest: boolean;
  /** That session's percentage (the new best). */
  bestPct: number;
  /** Id of the best session, for a deep link from the banner. */
  sessionId: string | null;
}

export interface DashboardData {
  profile: DashboardProfile;
  stats: DashboardStats;
  recent: RecentSession[];
  /** Most recent scored session, for the latest-result highlight. */
  latest: RecentSession | null;
  /** Per-session score percentages over time (oldest → newest), scored only. */
  trend: number[];
  /** Total completed+scored sessions (drives the "View all" affordance). */
  scoredCount: number;
  /** Id of the user's most recent in-progress session, if any. */
  resumeId: string | null;
  /** Practice cadence — current/longest streak and this week's count. */
  streaks: DashboardStreaks;
  /** New-personal-best moment for the latest scored session. */
  milestone: DashboardMilestone;
}

const pct = (score: number, max: number) =>
  max > 0 ? Math.round((score / max) * 100) : 0;

/** Resolve the difficulty band label for `years`, mirroring InterviewSetup. */
function resolveBand(
  bands: { label: string; minYears: number | null; maxYears: number | null }[],
  years: number,
): string | null {
  return (
    bands.find(
      (b) =>
        years >= (b.minYears ?? 0) &&
        years <= (b.maxYears ?? Number.MAX_SAFE_INTEGER),
    )?.label ?? null
  );
}

/** UTC day index for a timestamp (days since epoch), for streak arithmetic. */
const dayNum = (d: Date) => Math.floor(d.getTime() / 86_400_000);

/**
 * Derive practice streaks and cadence from the days the user started sessions.
 * Streaks are measured in UTC days, matching the date convention used for the
 * dashboard's session dates.
 */
function computeStreaks(startedAts: Date[], now: Date): DashboardStreaks {
  const todayNum = dayNum(now);
  const weekAgoMs = now.getTime() - 7 * 86_400_000;
  const thisWeek = startedAts.filter((d) => d.getTime() >= weekAgoMs).length;

  const days = [...new Set(startedAts.map(dayNum))].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const di of days) {
    run = prev !== null && di === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = di;
  }

  const present = new Set(days);
  let current = 0;
  // Count back from today; allow the streak to still be "alive" if the most
  // recent day was yesterday (today just hasn't been practised yet).
  let cursor = present.has(todayNum)
    ? todayNum
    : present.has(todayNum - 1)
      ? todayNum - 1
      : null;
  while (cursor !== null && present.has(cursor)) {
    current++;
    cursor--;
  }

  return { current, longest, thisWeek, activeToday: present.has(todayNum) };
}

/**
 * Returns the composed dashboard view, or `null` if the user has no profile /
 * hasn't completed onboarding (callers redirect to /onboarding in that case).
 */
export async function getDashboardData(
  userId: string,
): Promise<DashboardData | null> {
  const [profileRow] = await db
    .select({
      displayName: profiles.displayName,
      roleId: profiles.primaryRole,
      roleName: jobRoles.name,
      yearsExperience: profiles.yearsExperience,
      skills: profiles.skills,
      // Presence only — never read the CV content into the dashboard.
      hasCv: sql<boolean>`(${profiles.cvText} IS NOT NULL AND length(${profiles.cvText}) > 0)`,
      onboarding: profiles.onboarding,
    })
    .from(profiles)
    .leftJoin(jobRoles, eq(jobRoles.id, profiles.primaryRole))
    .where(eq(profiles.userId, userId));

  const completed =
    (profileRow?.onboarding as { completed?: boolean } | undefined)
      ?.completed === true;
  if (!profileRow || !completed) return null;

  const roleId = profileRow.roleId;

  // Trend/streak/milestone read the most recent N sessions rather than the
  // user's entire history — bounds the JS-side work without changing the shape
  // of these (recency-weighted) views for any realistic user.
  const TREND_SCAN_LIMIT = 200;

  const [statRows, recentRows, answeredRows, bandRows, aggRow] =
    await Promise.all([
      // Bounded scan of recent sessions for trend, streak and milestone.
      db
        .select({
          id: interviewSessions.id,
          status: interviewSessions.status,
          totalScore: interviewSessions.totalScore,
          maxScore: interviewSessions.maxScore,
          scoredAt: interviewSessions.scoredAt,
          startedAt: interviewSessions.startedAt,
        })
        .from(interviewSessions)
        .where(eq(interviewSessions.userId, userId))
        .orderBy(desc(interviewSessions.startedAt))
        .limit(TREND_SCAN_LIMIT),
    // Most recent completed + scored sessions, with display joins.
    db
      .select({
        id: interviewSessions.id,
        role: jobRoles.name,
        tech: techStacks.name,
        interviewType: interviewSessions.interviewType,
        totalScore: interviewSessions.totalScore,
        maxScore: interviewSessions.maxScore,
        scoredAt: interviewSessions.scoredAt,
      })
      .from(interviewSessions)
      .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
      .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
      .where(
        and(
          eq(interviewSessions.userId, userId),
          eq(interviewSessions.status, "completed"),
          isNotNull(interviewSessions.scoredAt),
        ),
      )
      .orderBy(desc(interviewSessions.scoredAt))
      .limit(5),
    db
      .select({ n: count() })
      .from(sessionQuestions)
      .innerJoin(
        interviewSessions,
        eq(interviewSessions.id, sessionQuestions.sessionId),
      )
      .where(
        and(
          eq(interviewSessions.userId, userId),
          isNotNull(sessionQuestions.answeredAt),
        ),
      ),
    roleId
      ? db
          .select({
            label: difficultyBands.label,
            minYears: difficultyBands.minYears,
            maxYears: difficultyBands.maxYears,
          })
          .from(difficultyBands)
          .where(eq(difficultyBands.jobRoleId, roleId))
          .orderBy(asc(difficultyBands.minYears))
      : Promise.resolve([]),
    // Completed count + scored average/best computed in SQL over ALL sessions,
    // so these headline stats stay exact regardless of the trend-scan bound.
    db
      .select({
        completed: sql<number>`count(*) filter (where ${interviewSessions.status} = 'completed')`,
        avgPct: sql<
          number | null
        >`avg(${interviewSessions.totalScore} * 100.0 / ${interviewSessions.maxScore}) filter (where ${interviewSessions.scoredAt} is not null and ${interviewSessions.maxScore} > 0)`,
        bestPct: sql<
          number | null
        >`max(${interviewSessions.totalScore} * 100.0 / ${interviewSessions.maxScore}) filter (where ${interviewSessions.scoredAt} is not null and ${interviewSessions.maxScore} > 0)`,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId)),
  ]);

  const scored = statRows.filter((s) => s.scoredAt && s.maxScore > 0);

  const agg = aggRow[0];
  const avgPctRaw = agg?.avgPct;
  const bestPctRaw = agg?.bestPct;
  const stats: DashboardStats = {
    completed: Number(agg?.completed ?? 0),
    avgPct: avgPctRaw != null ? Math.round(Number(avgPctRaw)) : null,
    bestPct: bestPctRaw != null ? Math.round(Number(bestPctRaw)) : null,
    questionsAnswered: Number(answeredRows[0]?.n ?? 0),
  };

  const recent: RecentSession[] = recentRows.map((r) => ({
    id: r.id,
    role: r.role,
    tech: r.tech,
    interviewType: r.interviewType,
    totalScore: r.totalScore,
    maxScore: r.maxScore,
    pct: pct(r.totalScore, r.maxScore),
    date: (r.scoredAt ?? new Date(0)).toISOString().slice(0, 10),
  }));

  // Oldest → newest, for a left-to-right trend line.
  const trend = scored
    .slice()
    .reverse()
    .map((s) => pct(s.totalScore, s.maxScore));

  const resumeId = statRows.find((s) => s.status === "in_progress")?.id ?? null;

  const streaks = computeStreaks(
    statRows.map((s) => s.startedAt),
    new Date(),
  );

  // Milestone: did the most-recently-scored session beat every prior one?
  // Identify "latest" by scoredAt so we don't depend on the startedAt ordering.
  const latestScored = scored.reduce<(typeof scored)[number] | null>(
    (best, s) =>
      !best || (s.scoredAt as Date) > (best.scoredAt as Date) ? s : best,
    null,
  );
  let milestone: DashboardMilestone = {
    isNewBest: false,
    bestPct: 0,
    sessionId: null,
  };
  if (latestScored && scored.length >= 2) {
    const latestPct = pct(latestScored.totalScore, latestScored.maxScore);
    const priorBest = Math.max(
      ...scored
        .filter((s) => s.id !== latestScored.id)
        .map((s) => pct(s.totalScore, s.maxScore)),
    );
    milestone = {
      isNewBest: latestPct > priorBest,
      bestPct: latestPct,
      sessionId: latestScored.id,
    };
  }

  return {
    profile: {
      userId,
      displayName: profileRow.displayName ?? "there",
      roleName: profileRow.roleName,
      yearsExperience: profileRow.yearsExperience,
      band: resolveBand(bandRows, profileRow.yearsExperience),
      skills: Array.isArray(profileRow.skills)
        ? (profileRow.skills as string[])
        : [],
      hasCv: Boolean(profileRow.hasCv),
    },
    stats,
    recent,
    latest: recent[0] ?? null,
    trend,
    scoredCount: scored.length,
    resumeId,
    streaks,
    milestone,
  };
}
