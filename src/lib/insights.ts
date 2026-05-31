import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  focusAreas,
  interviewSessions,
  questionsCache,
  sessionQuestions,
  techStacks,
} from "@db";

/**
 * Read-only "study insights" data layer.
 *
 * Everything here is *derived* from existing rows — session_questions joined to
 * completed+scored interview_sessions, plus the question metadata on
 * questions_cache. No AI calls, no new columns.
 *
 * Core rule: every per-question aggregate uses the **latest scored attempt per
 * questionId**. Retrying a question and improving therefore raises its area
 * average and drops it off the retry list, so progress shows and old scores are
 * never double-counted.
 */

/** A group must have at least this many attempts to be called a "weak area". */
const MIN_SAMPLES = 3;
/** Latest-attempt score (out of 10) strictly below this counts as "weak". */
const RETRY_MAX_SCORE = 6;
/** Hard cap on a single "retry weakest" session. */
const RETRY_LIMIT = 10;
/**
 * Upper bound on answered-question rows scanned for insights. Ordered by most
 * recent scored session, so this covers a generous window of recent attempts
 * (the latest attempt per question is what counts) without an unbounded scan.
 */
const ATTEMPT_SCAN_LIMIT = 1000;

export interface WeakArea {
  /** Full config to launch a pre-set practice session. */
  jobRoleId: string;
  techStackId: string;
  focusAreaId: string;
  difficulty: string;
  /** Display names. */
  focusName: string;
  techName: string;
  /** Mean of the latest attempts, on a 0–10 scale (one decimal). */
  avgScore: number;
  avgPct: number;
  /** Number of distinct questions counted (latest attempt each). */
  count: number;
}

export interface RetryCandidates {
  /** How many weak questions are available to retry. */
  count: number;
  /** The specific question ids (worst first), capped at RETRY_LIMIT. */
  questionIds: string[];
  /** Mean percentage across those questions, for the card copy. */
  avgPct: number;
}

export interface Insights {
  /** The single weakest area, or null until enough data exists. */
  weakest: WeakArea | null;
  /** Up to three weakest areas (includes `weakest`), for an "also weak" list. */
  ranked: WeakArea[];
  retry: RetryCandidates;
}

/** Latest scored attempt for one question. */
interface Attempt {
  questionId: string;
  score: number;
  maxScore: number;
  jobRoleId: string;
  techStackId: string;
  focusAreaId: string;
  difficulty: string;
  focusName: string;
  techName: string;
}

const pct = (score: number, max: number) =>
  max > 0 ? Math.round((score / max) * 100) : 0;

/** Most frequently occurring value in a list (first-seen wins ties). */
function mode(values: string[]): string {
  const counts = new Map<string, number>();
  let best = values[0] ?? "";
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

/**
 * Load the user's latest scored attempt for every question they've answered.
 *
 * Ordered newest-session-first so the first row seen per questionId is the most
 * recent attempt; later (older) attempts at the same question are dropped.
 */
async function loadLatestAttempts(userId: string): Promise<Attempt[]> {
  const rows = await db
    .select({
      questionId: sessionQuestions.questionId,
      score: sessionQuestions.score,
      maxScore: sessionQuestions.maxScore,
      jobRoleId: questionsCache.jobRoleId,
      techStackId: questionsCache.techStackId,
      focusAreaId: questionsCache.focusAreaId,
      difficulty: questionsCache.difficulty,
      focusName: focusAreas.name,
      techName: techStacks.name,
    })
    .from(sessionQuestions)
    .innerJoin(
      interviewSessions,
      eq(interviewSessions.id, sessionQuestions.sessionId),
    )
    .innerJoin(
      questionsCache,
      eq(questionsCache.id, sessionQuestions.questionId),
    )
    .innerJoin(focusAreas, eq(focusAreas.id, questionsCache.focusAreaId))
    .innerJoin(techStacks, eq(techStacks.id, questionsCache.techStackId))
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "completed"),
        isNotNull(interviewSessions.scoredAt),
        isNotNull(sessionQuestions.feedback),
      ),
    )
    .orderBy(desc(interviewSessions.scoredAt))
    .limit(ATTEMPT_SCAN_LIMIT);

  const latest = new Map<string, Attempt>();
  for (const r of rows) {
    if (!latest.has(r.questionId)) latest.set(r.questionId, r);
  }
  return [...latest.values()];
}

/**
 * Compose the study insights for a user: weakest area(s) + the list of
 * questions worth retrying. Returns empty/null shapes when there isn't enough
 * data yet (callers render a partial empty state).
 */
export async function getInsights(userId: string): Promise<Insights> {
  const attempts = await loadLatestAttempts(userId);

  /* ---- (a) Weak areas: group by role × stack × focus ------------------- */
  const groups = new Map<
    string,
    {
      jobRoleId: string;
      techStackId: string;
      focusAreaId: string;
      focusName: string;
      techName: string;
      totalScore: number;
      totalMax: number;
      difficulties: string[];
    }
  >();

  for (const a of attempts) {
    const key = `${a.jobRoleId}|${a.techStackId}|${a.focusAreaId}`;
    const g = groups.get(key);
    if (g) {
      g.totalScore += a.score;
      g.totalMax += a.maxScore;
      g.difficulties.push(a.difficulty);
    } else {
      groups.set(key, {
        jobRoleId: a.jobRoleId,
        techStackId: a.techStackId,
        focusAreaId: a.focusAreaId,
        focusName: a.focusName,
        techName: a.techName,
        totalScore: a.score,
        totalMax: a.maxScore,
        difficulties: [a.difficulty],
      });
    }
  }

  const ranked: WeakArea[] = [...groups.values()]
    .filter((g) => g.difficulties.length >= MIN_SAMPLES)
    .map((g) => ({
      jobRoleId: g.jobRoleId,
      techStackId: g.techStackId,
      focusAreaId: g.focusAreaId,
      // Reproduce a realistic config from what the user actually practised.
      difficulty: mode(g.difficulties),
      focusName: g.focusName,
      techName: g.techName,
      avgScore:
        Math.round(
          (g.totalMax > 0 ? (g.totalScore / g.totalMax) * 10 : 0) * 10,
        ) / 10,
      avgPct: pct(g.totalScore, g.totalMax),
      count: g.difficulties.length,
    }))
    .sort((a, b) => a.avgPct - b.avgPct)
    .slice(0, 3);

  /* ---- (b) Retry candidates: worst latest attempts --------------------- */
  const weak = attempts
    .filter((a) => a.score < RETRY_MAX_SCORE)
    .sort((a, b) => a.score - b.score);

  const retry: RetryCandidates = {
    count: weak.length,
    questionIds: weak.slice(0, RETRY_LIMIT).map((a) => a.questionId),
    avgPct: weak.length
      ? Math.round(
          (weak.reduce((s, a) => s + a.score, 0) /
            weak.reduce((s, a) => s + a.maxScore, 0)) *
            100,
        )
      : 0,
  };

  return { weakest: ranked[0] ?? null, ranked, retry };
}

/**
 * The server-side source of truth for "retry your weakest answers": resolve the
 * exact questions a session should be built from (worst first, capped). Shared
 * by `retryWeakAnswers` so the action never trusts client-supplied ids.
 */
export async function getRetryQuestionIds(userId: string): Promise<string[]> {
  const { retry } = await getInsights(userId);
  return retry.questionIds;
}
