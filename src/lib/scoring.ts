import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  interviewSessions,
  jobRoles,
  questionsCache,
  sessionQuestions,
} from "@db";
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
      status: interviewSessions.status,
      scoredAt: interviewSessions.scoredAt,
      difficulty: interviewSessions.difficulty,
      roleName: jobRoles.name,
    })
    .from(interviewSessions)
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .where(eq(interviewSessions.id, sessionId));

  if (!session) return;
  if (session.status !== "completed") return; // only score finished interviews
  if (session.scoredAt) return; // already scored — idempotent no-op

  const rows = await db
    .select({
      id: sessionQuestions.id,
      questionText: questionsCache.questionText,
      idealAnswer: questionsCache.idealAnswer,
      type: questionsCache.type,
      language: questionsCache.language,
      userAnswer: sessionQuestions.userAnswer,
      transcript: sessionQuestions.transcript,
      feedback: sessionQuestions.feedback,
    })
    .from(sessionQuestions)
    .innerJoin(
      questionsCache,
      eq(questionsCache.id, sessionQuestions.questionId),
    )
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
    const answer = (row.userAnswer ?? row.transcript ?? "").trim();
    if (!answer) {
      // Empty/skipped — score 0 without calling the model.
      results.set(row.id, {
        score: 0,
        feedback: "No answer was provided for this question.",
        strengths: [],
        improvements: ["Attempt an answer next time, even a partial one."],
      });
    } else if (row.type === "coding") {
      codeAnswered.push({
        id: row.id,
        question: row.questionText,
        idealSolution: row.idealAnswer,
        userCode: answer,
        language: row.language ?? DEFAULT_CODING_LANGUAGE,
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
  };

  // Text / behavioral answers — ONE Groq call. A ScoringError here means the
  // model never produced *any* valid score for this group (network/quota/
  // invalid output). We must NOT persist fallback zeros or mark the session
  // scored — that would permanently finalise a failure the user can never
  // retry. Re-throw so the session stays unscored and the "Try again" UI path
  // can re-run real scoring later. (A *partial* response is no longer an error:
  // scoreAnswersBatch returns the valid ids and we fill only the missing ones
  // with `fallback` below — those genuinely couldn't be scored this run.)
  if (answered.length > 0) {
    // A thrown ScoringError (or any error) propagates out of scoreSession,
    // leaving the session unscored and retryable — we never persist fallback
    // zeros for a fully-failed group. scoreAnswersBatch returns partial maps,
    // so `?? fallback` only fills ids the model genuinely couldn't return.
    const scores = await scoreAnswersBatch(
      session.roleName,
      session.difficulty,
      answered,
    );
    for (const item of answered) {
      results.set(item.id, scores.get(item.id) ?? fallback);
    }
  }

  // Coding submissions — ONE Groq call with the code-aware rubric. Same
  // all-or-nothing-failure handling: a ScoringError leaves the session
  // unscored (including mixed text+code sessions — if either group fully
  // fails, nothing is finalised) so it can be retried.
  if (codeAnswered.length > 0) {
    // Same all-or-nothing-failure handling as the text group above. For a
    // mixed text+code session, if EITHER group fully fails the error propagates
    // before any persistence below, so nothing is finalised — the whole session
    // stays unscored and retryable rather than half-zeroed.
    const scores = await scoreCodeBatch(
      session.roleName,
      session.difficulty,
      codeAnswered,
    );
    for (const item of codeAnswered) {
      results.set(item.id, scores.get(item.id) ?? fallback);
    }
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
          difficulty: session.difficulty,
          totalScore,
          maxScore,
          perQuestion: scored.map((r) => ({
            score: r.score,
            feedback: r.feedback ?? "",
          })),
        })
      : `You scored ${totalScore}/${maxScore} on this ${session.difficulty} ${session.roleName} interview.`;

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
