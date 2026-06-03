import "server-only";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  db,
  dojoAttempts,
  dojoProgress,
  dojoQuestions,
  dojoQuestionTopics,
  dojoTopics,
} from "@db";
import type { TestCase } from "@/components/code/types";
import { computeStreaks, type StreakInfo } from "@/lib/streaks";
import type {
  DojoDifficulty,
  DojoListItem,
  DojoQuestionDetail,
  DojoStats,
  DojoTopicRef,
} from "./types";

/**
 * Visibility rule: a question is visible to a user if it's active AND either a
 * shared built-in (created_by NULL) or one of their own personal problems.
 * Enforced on every learner-facing read — this is the access boundary that
 * keeps one user's personal problems out of another's list/solve/random.
 */
function visibleTo(userId: string) {
  return and(
    eq(dojoQuestions.isActive, true),
    or(isNull(dojoQuestions.createdBy), eq(dojoQuestions.createdBy, userId)),
  );
}

/**
 * Is this question visible to the user (active built-in or their own)? The
 * access gate for write actions that take a raw questionId (attempt, rating,
 * hint, review) so a leaked private-problem id can't be read or written to.
 */
export async function isQuestionVisible(
  questionId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: dojoQuestions.id })
    .from(dojoQuestions)
    .where(and(eq(dojoQuestions.id, questionId), visibleTo(userId)));
  return Boolean(row);
}

/**
 * Title + prompt for a visible question, or null. Combines the visibility gate
 * with the fetch in one query for actions that need the text (hint, review).
 */
export async function getVisibleQuestionMeta(
  questionId: string,
  userId: string,
): Promise<{ title: string; prompt: string } | null> {
  const [row] = await db
    .select({ title: dojoQuestions.title, prompt: dojoQuestions.prompt })
    .from(dojoQuestions)
    .where(and(eq(dojoQuestions.id, questionId), visibleTo(userId)));
  return row ?? null;
}

/** Every visible question with its topics and this user's solved/attempted state. */
export async function listQuestions(userId: string): Promise<DojoListItem[]> {
  const questions = await db
    .select({
      id: dojoQuestions.id,
      slug: dojoQuestions.slug,
      title: dojoQuestions.title,
      difficulty: dojoQuestions.difficulty,
      createdBy: dojoQuestions.createdBy,
    })
    .from(dojoQuestions)
    .where(visibleTo(userId))
    .orderBy(dojoQuestions.sortOrder, dojoQuestions.title);

  if (questions.length === 0) return [];
  const ids = questions.map((q) => q.id);

  const [tagRows, progRows] = await Promise.all([
    db
      .select({
        questionId: dojoQuestionTopics.questionId,
        slug: dojoTopics.slug,
        name: dojoTopics.name,
      })
      .from(dojoQuestionTopics)
      .innerJoin(dojoTopics, eq(dojoTopics.id, dojoQuestionTopics.topicId))
      .where(inArray(dojoQuestionTopics.questionId, ids))
      .orderBy(dojoTopics.sortOrder),
    db
      .select({
        questionId: dojoProgress.questionId,
        solved: dojoProgress.solved,
        attempts: dojoProgress.attempts,
      })
      .from(dojoProgress)
      .where(
        and(
          eq(dojoProgress.userId, userId),
          inArray(dojoProgress.questionId, ids),
        ),
      ),
  ]);

  const topicsByQ = new Map<string, DojoTopicRef[]>();
  for (const t of tagRows) {
    const arr = topicsByQ.get(t.questionId) ?? [];
    arr.push({ slug: t.slug, name: t.name });
    topicsByQ.set(t.questionId, arr);
  }
  const progByQ = new Map(progRows.map((p) => [p.questionId, p]));

  return questions.map((q) => {
    const p = progByQ.get(q.id);
    return {
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      topics: topicsByQ.get(q.id) ?? [],
      solved: p?.solved ?? false,
      attempted: (p?.attempts ?? 0) > 0,
      isMine: q.createdBy === userId,
    };
  });
}

/** One question's full detail for the solve view, restoring the last attempt. */
export async function getQuestionBySlug(
  slug: string,
  userId: string,
): Promise<DojoQuestionDetail | null> {
  const [q] = await db
    .select()
    .from(dojoQuestions)
    .where(and(eq(dojoQuestions.slug, slug), visibleTo(userId)));
  if (!q) return null;

  const [tagRows, progRows, attemptRows] = await Promise.all([
    db
      .select({ slug: dojoTopics.slug, name: dojoTopics.name })
      .from(dojoQuestionTopics)
      .innerJoin(dojoTopics, eq(dojoTopics.id, dojoQuestionTopics.topicId))
      .where(eq(dojoQuestionTopics.questionId, q.id))
      .orderBy(dojoTopics.sortOrder),
    db
      .select({ solved: dojoProgress.solved })
      .from(dojoProgress)
      .where(
        and(eq(dojoProgress.userId, userId), eq(dojoProgress.questionId, q.id)),
      ),
    db
      .select({ code: dojoAttempts.code })
      .from(dojoAttempts)
      .where(
        and(eq(dojoAttempts.userId, userId), eq(dojoAttempts.questionId, q.id)),
      )
      .orderBy(desc(dojoAttempts.createdAt))
      .limit(1),
  ]);

  return {
    id: q.id,
    slug: q.slug,
    title: q.title,
    prompt: q.prompt,
    difficulty: q.difficulty,
    starterCode: q.starterCode,
    fnName: q.fnName,
    testCases: q.testCases as TestCase[],
    topics: tagRows,
    solved: progRows[0]?.solved ?? false,
    isMine: q.createdBy === userId,
    lastAttemptCode: attemptRows[0]?.code ?? null,
  };
}

/** Topics (for filters + random picker). Global for now. */
export async function listTopics(): Promise<DojoTopicRef[]> {
  return db
    .select({ slug: dojoTopics.slug, name: dojoTopics.name })
    .from(dojoTopics)
    .orderBy(dojoTopics.sortOrder, dojoTopics.name);
}

/**
 * A random visible question slug — preferring unsolved ones — optionally scoped
 * to a topic and/or difficulty. Returns null if there are no matching questions.
 */
export async function pickRandomSlug(
  userId: string,
  opts?: { topicSlug?: string; difficulty?: DojoDifficulty },
): Promise<string | null> {
  const { topicSlug, difficulty } = opts ?? {};
  // `and()` ignores undefined, so the difficulty clause is a no-op when absent.
  const where = and(
    visibleTo(userId),
    difficulty ? eq(dojoQuestions.difficulty, difficulty) : undefined,
  );

  const base = db
    .select({ id: dojoQuestions.id, slug: dojoQuestions.slug })
    .from(dojoQuestions);

  const rows = topicSlug
    ? await base
        .innerJoin(
          dojoQuestionTopics,
          eq(dojoQuestionTopics.questionId, dojoQuestions.id),
        )
        .innerJoin(
          dojoTopics,
          and(
            eq(dojoTopics.id, dojoQuestionTopics.topicId),
            eq(dojoTopics.slug, topicSlug),
          ),
        )
        .where(where)
    : await base.where(where);

  if (rows.length === 0) return null;

  const solved = await db
    .select({ questionId: dojoProgress.questionId })
    .from(dojoProgress)
    .where(
      and(
        eq(dojoProgress.userId, userId),
        eq(dojoProgress.solved, true),
        inArray(
          dojoProgress.questionId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const solvedSet = new Set(solved.map((s) => s.questionId));
  const unsolved = rows.filter((r) => !solvedSet.has(r.id));
  const pool = unsolved.length > 0 ? unsolved : rows;

  return pool[Math.floor(Math.random() * pool.length)].slug;
}

/** Questions due for spaced-repetition review (dueAt in the past), soonest first. */
export async function listDueQuestions(
  userId: string,
): Promise<DojoListItem[]> {
  const due = await db
    .select({
      id: dojoQuestions.id,
      slug: dojoQuestions.slug,
      title: dojoQuestions.title,
      difficulty: dojoQuestions.difficulty,
      createdBy: dojoQuestions.createdBy,
      solved: dojoProgress.solved,
      attempts: dojoProgress.attempts,
    })
    .from(dojoProgress)
    .innerJoin(dojoQuestions, eq(dojoQuestions.id, dojoProgress.questionId))
    .where(
      and(
        eq(dojoProgress.userId, userId),
        eq(dojoQuestions.isActive, true),
        or(
          isNull(dojoQuestions.createdBy),
          eq(dojoQuestions.createdBy, userId),
        ),
        isNotNull(dojoProgress.dueAt),
        lte(dojoProgress.dueAt, new Date()),
      ),
    )
    .orderBy(dojoProgress.dueAt);

  if (due.length === 0) return [];
  const ids = due.map((d) => d.id);

  const tagRows = await db
    .select({
      questionId: dojoQuestionTopics.questionId,
      slug: dojoTopics.slug,
      name: dojoTopics.name,
    })
    .from(dojoQuestionTopics)
    .innerJoin(dojoTopics, eq(dojoTopics.id, dojoQuestionTopics.topicId))
    .where(inArray(dojoQuestionTopics.questionId, ids))
    .orderBy(dojoTopics.sortOrder);

  const topicsByQ = new Map<string, DojoTopicRef[]>();
  for (const t of tagRows) {
    const arr = topicsByQ.get(t.questionId) ?? [];
    arr.push({ slug: t.slug, name: t.name });
    topicsByQ.set(t.questionId, arr);
  }

  return due.map((d) => ({
    slug: d.slug,
    title: d.title,
    difficulty: d.difficulty,
    topics: topicsByQ.get(d.id) ?? [],
    solved: d.solved,
    attempted: d.attempts > 0,
    isMine: d.createdBy === userId,
  }));
}

/** The slug of the soonest problem currently due for review, or null. */
export async function pickNextDueSlug(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: dojoQuestions.slug })
    .from(dojoProgress)
    .innerJoin(dojoQuestions, eq(dojoQuestions.id, dojoProgress.questionId))
    .where(
      and(
        eq(dojoProgress.userId, userId),
        eq(dojoQuestions.isActive, true),
        or(
          isNull(dojoQuestions.createdBy),
          eq(dojoQuestions.createdBy, userId),
        ),
        isNotNull(dojoProgress.dueAt),
        lte(dojoProgress.dueAt, new Date()),
      ),
    )
    .orderBy(dojoProgress.dueAt)
    .limit(1);
  return row?.slug ?? null;
}

/** Count of questions currently due for review. */
export async function countDue(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(dojoProgress)
    .where(
      and(
        eq(dojoProgress.userId, userId),
        isNotNull(dojoProgress.dueAt),
        lte(dojoProgress.dueAt, new Date()),
      ),
    );
  return row?.n ?? 0;
}

/** Practice streak from the days the user has attempted any problem. */
export async function getDojoStreak(userId: string): Promise<StreakInfo> {
  const rows = await db
    .select({ createdAt: dojoAttempts.createdAt })
    .from(dojoAttempts)
    .where(eq(dojoAttempts.userId, userId));
  return computeStreaks(
    rows.map((r) => r.createdAt),
    new Date(),
  );
}

/** Solved totals: overall, by difficulty, and in the last 7 days. */
export async function getDojoStats(userId: string): Promise<DojoStats> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [solvedRows, diffRows, weekRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(dojoProgress)
      .where(
        and(eq(dojoProgress.userId, userId), eq(dojoProgress.solved, true)),
      ),
    db
      .select({ difficulty: dojoQuestions.difficulty, n: count() })
      .from(dojoProgress)
      .innerJoin(dojoQuestions, eq(dojoQuestions.id, dojoProgress.questionId))
      .where(
        and(eq(dojoProgress.userId, userId), eq(dojoProgress.solved, true)),
      )
      .groupBy(dojoQuestions.difficulty),
    db
      .select({ n: count() })
      .from(dojoProgress)
      .where(
        and(
          eq(dojoProgress.userId, userId),
          eq(dojoProgress.solved, true),
          gte(dojoProgress.solvedAt, weekAgo),
        ),
      ),
  ]);

  const byDifficulty: Record<DojoDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const r of diffRows) byDifficulty[r.difficulty] = r.n;

  return {
    solvedTotal: solvedRows[0]?.n ?? 0,
    byDifficulty,
    solvedThisWeek: weekRows[0]?.n ?? 0,
  };
}

/** The slug of the user's most recently attempted (still-visible) problem. */
export async function getLastAttemptedSlug(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ slug: dojoQuestions.slug })
    .from(dojoAttempts)
    .innerJoin(dojoQuestions, eq(dojoQuestions.id, dojoAttempts.questionId))
    .where(and(eq(dojoAttempts.userId, userId), visibleTo(userId)))
    .orderBy(desc(dojoAttempts.createdAt))
    .limit(1);
  return row?.slug ?? null;
}
