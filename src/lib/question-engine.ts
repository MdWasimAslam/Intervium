import { and, asc, eq } from "drizzle-orm";
import {
  db,
  focusAreas,
  interviewSessions,
  jobRoles,
  profiles,
  questionsCache,
  sessionQuestions,
  techStacks,
} from "@db";
import { computeSignature } from "@/lib/signature";
import {
  DEFAULT_CODING_LANGUAGE,
  generateQuestions,
  QuestionGenerationError,
  type GenerationContext,
} from "@/lib/gemini";
import { allowAction } from "@/lib/rate-limit";
import { reserveAiCalls } from "@/lib/ai-budget";
import { cvPlainText } from "@/lib/cv/parse";

/** Extra questions to generate beyond the immediate shortfall, to refill the pool. */
const GENERATION_BUFFER = 3;

export interface SessionConfig {
  id: string;
  userId: string;
  jobRoleId: string;
  techStackId: string;
  focusAreaId: string;
  difficulty: string;
  interviewType: "technical" | "behavioral" | "mixed" | "coding";
  questionCount: number;
}

export interface EngineQuestion {
  id: string;
  position: number;
  questionText: string;
}

/** Fisher–Yates shuffle (non-mutating). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Cache-first question retrieval for a session.
 *
 * - Idempotent: if the session already has questions, returns them in order.
 * - Otherwise selects unseen cached questions for the config's signature,
 *   tops up from Gemini if the pool is short, persists the selection as
 *   session_questions rows, and returns them.
 */
export async function getQuestionsForSession(
  session: SessionConfig,
): Promise<EngineQuestion[]> {
  // 1) Idempotency — replay an already-populated session.
  const existing = await db
    .select({
      id: sessionQuestions.questionId,
      position: sessionQuestions.position,
      questionText: questionsCache.questionText,
    })
    .from(sessionQuestions)
    .innerJoin(
      questionsCache,
      eq(questionsCache.id, sessionQuestions.questionId),
    )
    .where(eq(sessionQuestions.sessionId, session.id))
    .orderBy(asc(sessionQuestions.position));

  if (existing.length > 0) {
    console.log(
      `[question-engine] session=${session.id} replay existing=${existing.length} (no lookup)`,
    );
    return existing;
  }

  const signature = computeSignature({
    jobRoleId: session.jobRoleId,
    techStackId: session.techStackId,
    focusAreaId: session.focusAreaId,
    difficulty: session.difficulty,
    type: session.interviewType,
  });

  // 2) Cache pool for this signature + 3) questions this user has already seen.
  const [pool, seenRows] = await Promise.all([
    db
      .select({
        id: questionsCache.id,
        questionText: questionsCache.questionText,
      })
      .from(questionsCache)
      .where(
        and(
          eq(questionsCache.signature, signature),
          eq(questionsCache.isActive, true),
        ),
      ),
    db
      .select({ questionId: sessionQuestions.questionId })
      .from(sessionQuestions)
      .innerJoin(
        interviewSessions,
        eq(interviewSessions.id, sessionQuestions.sessionId),
      )
      .where(eq(interviewSessions.userId, session.userId)),
  ]);

  const seen = new Set(seenRows.map((r) => r.questionId));
  const unseen = pool.filter((q) => !seen.has(q.id));

  // 4) Pick from the unseen pool.
  const picked = shuffle(unseen).slice(0, session.questionCount);
  let fromCache = picked.length;
  let generatedCount = 0;

  // 5) Top up if the unseen pool is short.
  if (picked.length < session.questionCount) {
    const shortfall = session.questionCount - picked.length;

    // Per-user rate limit — kills accidental retry loops before any AI work.
    if (!allowAction(`gen:${session.userId}`)) {
      throw new QuestionGenerationError(
        "You're generating interviews too fast. Please wait a moment and try again.",
      );
    }

    // Daily AI budget — when spent, degrade gracefully instead of calling
    // Gemini (and 429-ing): refill from the cache by relaxing the "unseen"
    // rule, repeating questions the user has seen before.
    if (await reserveAiCalls(1)) {
      const ctx = await buildContext(session, shortfall + GENERATION_BUFFER);
      const generated = await generateQuestions(ctx);

      const isCoding = session.interviewType === "coding";
      const inserted = await db
        .insert(questionsCache)
        .values(
          generated.map((g) => ({
            jobRoleId: session.jobRoleId,
            techStackId: session.techStackId,
            focusAreaId: session.focusAreaId,
            difficulty: session.difficulty,
            type: isCoding ? ("coding" as const) : ("either" as const),
            language: isCoding
              ? (g.language ?? DEFAULT_CODING_LANGUAGE)
              : null,
            questionText: g.question_text,
            idealAnswer: g.ideal_answer,
            signature,
            source: "ai" as const,
          })),
        )
        .returning({
          id: questionsCache.id,
          questionText: questionsCache.questionText,
        });

      const needed = session.questionCount - picked.length;
      picked.push(...inserted.slice(0, needed));
      generatedCount = needed;

      console.log(
        `[question-engine] generated ${inserted.length} new rows (used ${needed})`,
      );
    } else {
      // Budget spent for today — reuse seen questions to still fill the session.
      const pickedIds = new Set(picked.map((p) => p.id));
      const repeats = shuffle(pool.filter((q) => !pickedIds.has(q.id))).slice(
        0,
        shortfall,
      );
      picked.push(...repeats);

      if (picked.length === 0) {
        // No cache to fall back on for this config — ask the user to try later.
        throw new QuestionGenerationError(
          "We've reached today's limit for generating new questions. Please try again tomorrow, or pick a role/stack that already has questions.",
        );
      }

      console.log(
        `[question-engine] daily AI budget spent — served ${repeats.length} cached repeat(s) instead of generating`,
      );
    }
  }

  // 6) Persist the selection as session_questions, in order.
  const ordered = picked.map((q, i) => ({
    id: q.id,
    position: i,
    questionText: q.questionText,
  }));

  if (ordered.length > 0) {
    await db.insert(sessionQuestions).values(
      ordered.map((q) => ({
        sessionId: session.id,
        questionId: q.id,
        position: q.position,
      })),
    );
  }

  console.log(
    `[question-engine] session=${session.id} cache=${fromCache} generated=${generatedCount} (pool=${pool.length}, unseen_before=${unseen.length})`,
  );

  // 7) Return in order.
  return ordered;
}

/** Assemble the Gemini prompt context from the session + the user's profile. */
async function buildContext(
  session: SessionConfig,
  count: number,
): Promise<GenerationContext> {
  const [[role], [tech], [focus], [profile]] = await Promise.all([
    db
      .select({ name: jobRoles.name })
      .from(jobRoles)
      .where(eq(jobRoles.id, session.jobRoleId)),
    db
      .select({ name: techStacks.name })
      .from(techStacks)
      .where(eq(techStacks.id, session.techStackId)),
    db
      .select({ name: focusAreas.name })
      .from(focusAreas)
      .where(eq(focusAreas.id, session.focusAreaId)),
    db
      .select({
        years: profiles.yearsExperience,
        skills: profiles.skills,
        cvText: profiles.cvText,
        onboarding: profiles.onboarding,
      })
      .from(profiles)
      .where(eq(profiles.userId, session.userId)),
  ]);

  const onboarding = (profile?.onboarding ?? {}) as { targetRole?: string };

  return {
    roleName: role?.name ?? "Software Developer",
    techStack: tech?.name ?? "General",
    focusArea: focus?.name ?? "General",
    difficulty: session.difficulty,
    interviewType: session.interviewType,
    count,
    yearsExperience: profile?.years ?? 0,
    skills: Array.isArray(profile?.skills) ? (profile.skills as string[]) : [],
    targetRole: onboarding.targetRole ?? "",
    cvText: cvPlainText(profile?.cvText),
  };
}

// Re-export so callers can catch generation failures cleanly.
export { QuestionGenerationError };
