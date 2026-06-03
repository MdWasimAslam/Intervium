"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  dojoAttempts,
  dojoProgress,
  dojoQuestions,
  dojoQuestionTopics,
} from "@db";
import { withTransaction } from "@db/tx";
import { getCurrentUser } from "@/lib/session";
import { allowAction } from "@/lib/rate-limit";
import { reserveAiCalls } from "@/lib/ai-budget";
import {
  CvAiError,
  generateDojoQuestionDraft,
  getDojoHint,
  reviewDojoSolution,
  type DojoQuestionDraft,
  type DojoReview,
} from "@/lib/groq";
import { schedule } from "@/lib/dojo/spaced-repetition";
import {
  getQuestionBySlug,
  getVisibleQuestionMeta,
  isQuestionVisible,
  pickNextDueSlug,
  pickRandomSlug,
} from "@/lib/dojo/queries";
import { resolveTopicIds, setQuestionTopics, slugify } from "@/lib/dojo/topics";
import { isUniqueViolation } from "@/lib/actions/admin/util";
import type { Result } from "@/lib/actions/result";
import type { DojoQuestionDetail } from "@/lib/dojo/types";

const attemptSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string().min(1).max(50_000),
  status: z.enum(["passed", "failed"]),
  testsPassed: z.number().int().min(0),
  testsTotal: z.number().int().min(0),
  runtimeMs: z.number().int().min(0).optional(),
  hintsUsed: z.number().int().min(0).default(0),
});

export type SaveAttemptInput = z.input<typeof attemptSchema>;

/**
 * Record one run: append to the attempt history and upsert the per-question
 * progress rollup (attempt count, last-attempted, and — once any run passes —
 * solved + solvedAt). Idempotent on the (user, question) progress row.
 */
export async function saveDojoAttempt(
  input: SaveAttemptInput,
): Promise<Result<{ solved: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = attemptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid submission." };
  }
  const a = parsed.data;
  if (!(await isQuestionVisible(a.questionId, user.id))) {
    return { ok: false, error: "Problem not found." };
  }
  const now = new Date();
  const justPassed = a.status === "passed";

  try {
    await db.insert(dojoAttempts).values({
      userId: user.id,
      questionId: a.questionId,
      code: a.code,
      status: a.status,
      testsPassed: a.testsPassed,
      testsTotal: a.testsTotal,
      runtimeMs: a.runtimeMs,
      hintsUsed: a.hintsUsed,
    });

    await db
      .insert(dojoProgress)
      .values({
        userId: user.id,
        questionId: a.questionId,
        solved: justPassed,
        attempts: 1,
        lastAttemptedAt: now,
        solvedAt: justPassed ? now : null,
      })
      .onConflictDoUpdate({
        target: [dojoProgress.userId, dojoProgress.questionId],
        set: {
          attempts: sql`${dojoProgress.attempts} + 1`,
          lastAttemptedAt: now,
          solved: sql`${dojoProgress.solved} OR ${justPassed}`,
          solvedAt: sql`COALESCE(${dojoProgress.solvedAt}, ${justPassed ? now : null})`,
        },
      });

    // No revalidatePath here: the user is actively solving ON /dojo, and
    // revalidating it forces a full server re-render of the page (stats, list)
    // on every submit. The solve view already reflects solved state client-side;
    // the list/stats refresh on the next navigation.
    return { ok: true, data: { solved: justPassed } };
  } catch (error) {
    console.error("[saveDojoAttempt]", error);
    return {
      ok: false,
      error: "Could not save your attempt. Please try again.",
    };
  }
}

const randomSchema = z.object({
  topicSlug: z.string().trim().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export type RandomDojoInput = z.infer<typeof randomSchema>;

/**
 * Pick a random (preferring unsolved) question, optionally scoped to a topic
 * and/or difficulty.
 */
export async function randomDojoQuestion(
  input?: RandomDojoInput,
): Promise<Result<{ slug: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = randomSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const slug = await pickRandomSlug(user.id, parsed.data);
  if (!slug) {
    return { ok: false, error: "No questions match those filters yet." };
  }
  return { ok: true, data: { slug } };
}

const hintSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string().max(50_000),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

/** A single tiered AI hint for a problem — a nudge, never the solution. */
export async function getDojoHintAction(
  input: z.infer<typeof hintSchema>,
): Promise<Result<{ hint: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = hintSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid hint request." };

  if (!allowAction(`dojo-hint:${user.id}`, 15, 60_000)) {
    return { ok: false, error: "Slow down a touch — try again in a moment." };
  }

  const q = await getVisibleQuestionMeta(parsed.data.questionId, user.id);
  if (!q) return { ok: false, error: "Question not found." };

  try {
    const hint = await getDojoHint(
      {
        title: q.title,
        prompt: q.prompt,
        code: parsed.data.code,
        level: parsed.data.level,
      },
      user.id,
    );
    return { ok: true, data: { hint } };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not get a hint right now.";
    return { ok: false, error: msg };
  }
}

const reviewSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string().min(1).max(50_000),
  testsSummary: z.string().max(2000),
});

/** AI review of a submitted solution — correctness verdict + suggestions. */
export async function reviewDojoSolutionAction(
  input: z.infer<typeof reviewSchema>,
): Promise<Result<DojoReview>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid review request." };

  if (!allowAction(`dojo-review:${user.id}`, 8, 60_000)) {
    return { ok: false, error: "Slow down a touch — try again in a moment." };
  }
  // Confirm visibility before reserving budget so we never spend a call on a
  // question the user can't see.
  const q = await getVisibleQuestionMeta(parsed.data.questionId, user.id);
  if (!q) return { ok: false, error: "Question not found." };
  if (!(await reserveAiCalls(1))) {
    return {
      ok: false,
      error: "The daily AI budget is spent. Please try again tomorrow.",
    };
  }

  try {
    const review = await reviewDojoSolution(
      {
        title: q.title,
        prompt: q.prompt,
        code: parsed.data.code,
        testsSummary: parsed.data.testsSummary || "No test run was recorded.",
      },
      user.id,
    );
    return { ok: true, data: review };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not review right now.";
    return { ok: false, error: msg };
  }
}

const rateSchema = z.object({
  questionId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

/**
 * Record a spaced-repetition self-rating, advancing the SM-2 schedule and
 * setting the next due date for this question.
 */
export async function rateDojoQuestion(
  input: z.infer<typeof rateSchema>,
): Promise<Result<{ dueInDays: number; nextDueSlug: string | null }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid rating." };
  const { questionId, rating } = parsed.data;

  if (!(await isQuestionVisible(questionId, user.id))) {
    return { ok: false, error: "Problem not found." };
  }

  try {
    const [prog] = await db
      .select({
        ease: dojoProgress.ease,
        intervalDays: dojoProgress.intervalDays,
      })
      .from(dojoProgress)
      .where(
        and(
          eq(dojoProgress.userId, user.id),
          eq(dojoProgress.questionId, questionId),
        ),
      );

    const next = schedule(
      { ease: prog?.ease ?? 250, intervalDays: prog?.intervalDays ?? 0 },
      rating,
    );
    // "Again" returns 0 days; floor it to a short delay so the card leaves the
    // immediate due queue (otherwise dueAt === now and it loops instantly).
    const AGAIN_FLOOR_MS = 10 * 60_000; // 10 minutes — back later this session
    const dueMs = next.dueInDays * 86_400_000;
    const dueAt = new Date(Date.now() + (dueMs > 0 ? dueMs : AGAIN_FLOOR_MS));

    await db
      .insert(dojoProgress)
      .values({
        userId: user.id,
        questionId,
        ease: next.ease,
        intervalDays: next.intervalDays,
        dueAt,
        lastConfidence: rating,
      })
      .onConflictDoUpdate({
        target: [dojoProgress.userId, dojoProgress.questionId],
        set: {
          ease: next.ease,
          intervalDays: next.intervalDays,
          dueAt,
          lastConfidence: rating,
        },
      });

    // Refresh the review page and the Dojo home so its "due for review" count
    // reflects the new schedule without a hard reload.
    revalidatePath("/dojo/review");
    revalidatePath("/dojo");
    // The just-rated problem now has a future dueAt, so this is the *next* one
    // due (if any) — lets the solver jump straight to it.
    const nextDueSlug = await pickNextDueSlug(user.id);
    return { ok: true, data: { dueInDays: next.dueInDays, nextDueSlug } };
  } catch (error) {
    console.error("[rateDojoQuestion]", error);
    return { ok: false, error: "Could not save your rating." };
  }
}

/* -------------------------------------------------------------------------- */
/* Personal problems (AI-generated, private to the creator)                   */
/* -------------------------------------------------------------------------- */

/** Load one visible problem's full detail (for the in-place editor tab). */
export async function getDojoQuestionAction(
  slug: string,
): Promise<Result<DojoQuestionDetail>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const q = await getQuestionBySlug(slug, user.id);
  if (!q) return { ok: false, error: "Problem not found." };
  return { ok: true, data: q };
}

const generateSchema = z.object({
  topic: z.string().trim().max(60).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prompt: z.string().trim().max(2000).optional(),
});

/**
 * Draft an AI problem (incl. a reference solution for client-side verification).
 * Reserves 2 budget calls to cover the dialog's one silent retry. Persists
 * nothing — the client verifies, then calls `createPersonalDojoQuestion`.
 */
export async function generateDojoQuestionDraftAction(
  input: z.infer<typeof generateSchema>,
): Promise<Result<DojoQuestionDraft>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  if (!allowAction(`dojo-generate:${user.id}`, 5, 60_000)) {
    return { ok: false, error: "Slow down a touch — try again in a moment." };
  }
  if (!(await reserveAiCalls(2))) {
    return {
      ok: false,
      error: "The daily AI budget is spent. Please try again tomorrow.",
    };
  }

  try {
    const draft = await generateDojoQuestionDraft(parsed.data, user.id);
    return { ok: true, data: draft };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not generate a problem right now.";
    return { ok: false, error: msg };
  }
}

const personalCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  prompt: z.string().trim().min(1, "Prompt is required.").max(8000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  fnName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(
      /^[A-Za-z_$][A-Za-z0-9_$]*$/,
      "Function name must be a valid identifier.",
    ),
  starterCode: z.string().min(1).max(20000),
  testCases: z
    .array(
      z.object({
        input: z.array(z.unknown()),
        expected: z.unknown(),
        hidden: z.boolean().optional(),
      }),
    )
    .min(1, "Add at least one test case."),
  topics: z.array(z.string().trim().min(1)).max(8),
});

type PersonalQuestion = z.infer<typeof personalCreateSchema>;

/**
 * Insert one personal problem: namespaced slug with numeric-suffix retry on
 * collision, then topic links. Returns the final slug; throws if no free slug.
 * Shared by the single create and the JSON import.
 */
async function insertPersonalQuestion(
  userId: string,
  q: PersonalQuestion,
): Promise<string> {
  const { topics, ...fields } = q;
  const base =
    `usr-${userId.slice(0, 8)}-${slugify(q.title) || "problem"}`.slice(0, 110);
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    try {
      const [row] = await db
        .insert(dojoQuestions)
        .values({
          slug,
          title: fields.title,
          prompt: fields.prompt,
          difficulty: fields.difficulty,
          fnName: fields.fnName,
          starterCode: fields.starterCode,
          testCases: fields.testCases,
          createdBy: userId,
          isActive: true,
        })
        .returning({ id: dojoQuestions.id, slug: dojoQuestions.slug });
      await setQuestionTopics(row.id, await resolveTopicIds(topics));
      return row.slug;
    } catch (error) {
      if (isUniqueViolation(error)) continue; // slug taken — try next suffix
      throw error;
    }
  }
  throw new Error("no free slug");
}

/** Save a single problem as the user's own private problem. */
export async function createPersonalDojoQuestion(
  input: PersonalQuestion,
): Promise<Result<{ slug: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = personalCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid problem.",
    };
  }

  try {
    const slug = await insertPersonalQuestion(user.id, parsed.data);
    revalidatePath("/dojo");
    return { ok: true, data: { slug } };
  } catch (error) {
    console.error("[createPersonalDojoQuestion]", error);
    return { ok: false, error: "Could not save the problem." };
  }
}

/**
 * Import one or more personal problems from pasted JSON (a single object or an
 * array). Each is shape-validated; valid ones are created as private problems.
 */
export async function importPersonalDojoQuestions(input: {
  json: string;
}): Promise<
  Result<{ created: number; failed: number; firstSlug: string | null }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  let raw: unknown;
  try {
    raw = JSON.parse(input.json);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }

  const arr = Array.isArray(raw) ? raw : [raw];
  const parsed = z.array(personalCreateSchema).max(50).safeParse(arr);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "(root)";
    return {
      ok: false,
      error: `Validation failed at ${where}: ${issue?.message ?? "invalid format"}`,
    };
  }
  if (parsed.data.length === 0) {
    return { ok: false, error: "No problems found in the JSON." };
  }

  let created = 0;
  let failed = 0;
  let firstSlug: string | null = null;
  for (const q of parsed.data) {
    try {
      const slug = await insertPersonalQuestion(user.id, q);
      created++;
      if (!firstSlug) firstSlug = slug;
    } catch (error) {
      console.error("[importPersonalDojoQuestions] item failed", error);
      failed++;
    }
  }

  revalidatePath("/dojo");
  return { ok: true, data: { created, failed, firstSlug } };
}

/** Delete one of the user's OWN problems (never built-ins or others'). */
export async function deletePersonalDojoQuestion(
  input: unknown,
): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid problem." };
  const { id } = p.data;

  const [q] = await db
    .select({ createdBy: dojoQuestions.createdBy })
    .from(dojoQuestions)
    .where(eq(dojoQuestions.id, id));
  if (!q) return { ok: false, error: "Problem not found." };
  if (q.createdBy !== user.id) {
    return { ok: false, error: "You can only delete your own problems." };
  }

  // Keep anything with practice history so attempts/review aren't orphaned.
  const [{ n }] = await db
    .select({ n: count() })
    .from(dojoAttempts)
    .where(eq(dojoAttempts.questionId, id));
  if (n > 0) {
    return {
      ok: false,
      error: "This problem has practice history and can't be deleted.",
    };
  }

  await withTransaction(async (tx) => {
    await tx.delete(dojoProgress).where(eq(dojoProgress.questionId, id));
    await tx
      .delete(dojoQuestionTopics)
      .where(eq(dojoQuestionTopics.questionId, id));
    await tx.delete(dojoQuestions).where(eq(dojoQuestions.id, id));
  });
  revalidatePath("/dojo");
  return { ok: true, data: true };
}
