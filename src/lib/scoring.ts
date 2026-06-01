import { and, asc, eq, sql } from "drizzle-orm";
import { db, interviewSessions, jobRoles, sessionQuestions } from "@db";
import {
  DEFAULT_CODING_LANGUAGE,
  generateSummary,
  scoreAnswersBatch,
  scoreCodeBatch,
  type AnswerScore,
  type BatchCodeItem,
  type BatchScoreItem,
} from "@/lib/groq";
import { AiBudgetError, reserveAiCalls } from "@/lib/ai-budget";
import { getSettings } from "@/lib/settings";

const MAX_PER_QUESTION = 10;

/**
 * Score every answered question in a completed session, aggregate the totals,
 * and write a one-line summary. Idempotent:
 *  - returns early if the session is already scored (scored_at set),
 *  - skips individual questions that already have feedback (partial re-runs).
 */
export async function scoreSession(sessionId: string): Promise<void> {
  const [session] = await db
    .select({
      id: interviewSessions.id,
      userId: interviewSessions.userId,
      status: interviewSessions.status,
      scoredAt: interviewSessions.scoredAt,
      skillLevel: interviewSessions.skillLevel,
      roleName: jobRoles.name,
      professionType: jobRoles.professionType,
    })
    .from(interviewSessions)
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .where(eq(interviewSessions.id, sessionId));

  if (!session) return;
  if (session.status !== "completed") return; // only score finished interviews
  if (session.scoredAt) return; // already scored — idempotent no-op

  // Scoring calibration target. AI sessions carry a skill level; bank sessions
  // don't (curated answers set the bar), so fall back to a neutral label.
  const level = session.skillLevel ?? "mid-level";

  // Question content lives inline on the transcript (self-contained rows), so
  // scoring no longer depends on any shared question pool.
  const rows = await db
    .select({
      id: sessionQuestions.id,
      questionText: sessionQuestions.questionText,
      idealAnswer: sessionQuestions.idealAnswer,
      modality: sessionQuestions.modality,
      userAnswer: sessionQuestions.userAnswer,
      feedback: sessionQuestions.feedback,
    })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.sessionId, sessionId))
    .orderBy(asc(sessionQuestions.position));

  // Rows still needing a score (idempotent: skip ones already scored).
  const pending = rows.filter((row) => row.feedback === null);

  // Resolve a score for every pending row, keyed by row id. Coding questions
  // go to a code-aware rubric; everything else to the text rubric — each is a
  // separate single Groq call.
  const results = new Map<string, AnswerScore>();
  const answered: BatchScoreItem[] = [];
  const codeAnswered: BatchCodeItem[] = [];

  for (const row of pending) {
    const answer = (row.userAnswer ?? "").trim();
    if (!answer) {
      // Empty/skipped — score 0 without calling the model.
      results.set(row.id, {
        score: 0,
        feedback: "No answer was provided for this question.",
        strengths: [],
        improvements: ["Attempt an answer next time, even a partial one."],
        missingConcepts: [],
      });
    } else if (row.modality === "coding") {
      codeAnswered.push({
        id: row.id,
        question: row.questionText,
        idealSolution: row.idealAnswer,
        userCode: answer,
        language: DEFAULT_CODING_LANGUAGE,
      });
    } else {
      answered.push({
        id: row.id,
        question: row.questionText,
        idealAnswer: row.idealAnswer,
        userAnswer: answer,
      });
    }
  }

  // Reserve daily AI budget for the batch calls we're about to make (one per
  // non-empty group). If spent, defer (don't persist zeros or mark scored) so
  // a later visit re-runs scoring for real once the budget resets.
  const batchCalls = (answered.length ? 1 : 0) + (codeAnswered.length ? 1 : 0);
  if (batchCalls > 0 && !(await reserveAiCalls(batchCalls))) {
    throw new AiBudgetError(
      "Scoring is paused — we've reached today's AI limit. Your answers are saved; please check back later.",
    );
  }

  const fallback: AnswerScore = {
    score: 0,
    feedback: "We couldn't score this answer automatically.",
    strengths: [],
    improvements: [],
    missingConcepts: [],
  };

  // Score the two independent answer groups CONCURRENTLY. Text/behavioral go to
  // the text rubric, coding submissions to the code-aware rubric — each is a
  // single Groq call with no shared data, so running them in parallel (instead
  // of awaiting text, then code) roughly halves wall-clock scoring time for a
  // mixed session. Each batch helper short-circuits an empty group to an empty
  // map without calling the model, so passing an empty array is safe and free.
  //
  // Failure semantics: if EITHER group fully fails it throws, and Promise.all
  // rejects on that first rejection — before any persistence below — so nothing
  // is finalised and the whole session stays unscored/retryable (never
  // half-zeroed). The batch helpers return partial maps on success, so
  // `?? fallback` only fills ids the model genuinely couldn't score this run.
  // Admin-selected grading backend (Groq by default; DeepSeek when toggled).
  const { scoringProvider } = await getSettings();
  const [textScores, codeScores] = await Promise.all([
    scoreAnswersBatch(
      session.roleName,
      level,
      answered,
      session.userId,
      session.professionType,
      scoringProvider,
    ),
    scoreCodeBatch(
      session.roleName,
      level,
      codeAnswered,
      session.userId,
      scoringProvider,
    ),
  ]);
  for (const item of answered) {
    results.set(item.id, textScores.get(item.id) ?? fallback);
  }
  for (const item of codeAnswered) {
    results.set(item.id, codeScores.get(item.id) ?? fallback);
  }

  // Persist every pending row's score in ONE statement (was one UPDATE per
  // row — an N+1 round trip per question). UPDATE … FROM (VALUES …) joins each
  // row id to its resolved score in a single query.
  const updates = pending
    .map((row) => ({ id: row.id, result: results.get(row.id) }))
    .filter((u): u is { id: string; result: AnswerScore } => Boolean(u.result));

  if (updates.length > 0) {
    const tuples = sql.join(
      updates.map((u) => {
        const detail = JSON.stringify({
          strengths: u.result.strengths,
          improvements: u.result.improvements,
          // Concepts the answer missed and (coding) a stronger alternative —
          // power the "Missing concepts" / "Better approach" results sections.
          missingConcepts: u.result.missingConcepts,
          betterApproach: u.result.betterApproach,
          // Rubric breakdown for the results UI. JSON.stringify drops whichever
          // is undefined (text answers have `rubric`, coding has `codeRubric`,
          // empty/fallback scores have neither).
          rubric: u.result.rubric,
          codeRubric: u.result.codeRubric,
        });
        return sql`(${u.id}::uuid, ${u.result.score}::int, ${u.result.feedback}::text, ${detail}::jsonb)`;
      }),
      sql`, `,
    );

    await db.execute(sql`
      UPDATE ${sessionQuestions} AS sq
      SET score = v.score,
          max_score = ${MAX_PER_QUESTION},
          feedback = v.feedback,
          feedback_detail = v.detail
      FROM (VALUES ${tuples}) AS v(id, score, feedback, detail)
      WHERE sq.id = v.id
    `);
  }

  // Aggregate from all rows (now scored).
  const scored = await db
    .select({
      score: sessionQuestions.score,
      maxScore: sessionQuestions.maxScore,
      feedback: sessionQuestions.feedback,
    })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.sessionId, sessionId));

  const totalScore = scored.reduce((sum, r) => sum + r.score, 0);
  const maxScore = scored.reduce((sum, r) => sum + r.maxScore, 0);

  // The one-line summary is a nice-to-have; only spend budget on it if we have
  // it. Skip the AI call entirely (deterministic fallback) when no answer
  // actually required a model call — i.e. every question was empty/skipped, so
  // there's nothing substantive to summarise and no point burning budget.
  const needsSummaryCall = answered.length > 0 || codeAnswered.length > 0;
  const summary =
    needsSummaryCall && (await reserveAiCalls(1))
      ? await generateSummary({
          roleName: session.roleName,
          difficulty: level,
          totalScore,
          maxScore,
          perQuestion: scored.map((r) => ({
            score: r.score,
            feedback: r.feedback ?? "",
          })),
          userId: session.userId,
        })
      : `You scored ${totalScore}/${maxScore} on this ${session.roleName} interview.`;

  await db
    .update(interviewSessions)
    .set({ totalScore, maxScore, summary, scoredAt: new Date() })
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.status, "completed"),
      ),
    );
}
