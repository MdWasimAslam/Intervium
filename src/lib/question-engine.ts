import { and, asc, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import {
  bankQuestions,
  db,
  interviewSessions,
  jobRoles,
  profiles,
  sessionQuestions,
  techStacks,
} from "@db";
import {
  generateQuestions,
  QuestionGenerationError,
  type GenerationContext,
  type SkillLevel,
} from "@/lib/groq";
import { allowAction } from "@/lib/rate-limit";
import { reserveAiCalls } from "@/lib/ai-budget";
import { cvPlainText } from "@/lib/cv/parse";

export interface SessionConfig {
  id: string;
  userId: string;
  mode: "bank" | "ai";
  jobRoleId: string;
  techStackId: string;
  skillLevel: SkillLevel | null;
  questionCount: number;
}

export interface EngineQuestion {
  id: string;
  position: number;
  questionText: string;
}

/** What gets written onto a transcript row, before position is assigned. */
interface PickedQuestion {
  bankQuestionId: string | null;
  questionText: string;
  idealAnswer: string;
  modality: "text" | "coding";
}

/** Read a session's transcript rows in order (the engine's idempotent answer). */
async function readPersisted(sessionId: string): Promise<EngineQuestion[]> {
  return db
    .select({
      id: sessionQuestions.id,
      position: sessionQuestions.position,
      questionText: sessionQuestions.questionText,
    })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.sessionId, sessionId))
    .orderBy(asc(sessionQuestions.position));
}

/**
 * Resolve the questions for a session.
 *
 * - Idempotent: a session that already has transcript rows replays them.
 * - Bank mode: random, not-yet-seen active questions for the (role, tech).
 * - AI mode: questions generated live and written ONLY onto this transcript —
 *   never cached or reused. When the daily AI budget is spent there is no
 *   fallback (no cache exists), so it fails with a clear message.
 */
export async function getQuestionsForSession(
  session: SessionConfig,
): Promise<EngineQuestion[]> {
  // 1) Idempotency — replay an already-populated session.
  const existing = await readPersisted(session.id);
  if (existing.length > 0) return existing;

  // 2) Pick this session's questions by mode.
  const picked =
    session.mode === "bank"
      ? await pickBankQuestions(session)
      : await generateAiQuestions(session);

  // 3) Persist the selection inline, in order. Two requests racing on the same
  //    session are made safe by the unique (session_id, position) constraint.
  if (picked.length > 0) {
    await db
      .insert(sessionQuestions)
      .values(
        picked.map((q, i) => ({
          sessionId: session.id,
          bankQuestionId: q.bankQuestionId,
          questionText: q.questionText,
          idealAnswer: q.idealAnswer,
          modality: q.modality,
          position: i,
        })),
      )
      .onConflictDoNothing();
  }

  // 4) Re-read the committed set so racing callers return the same ordering.
  const persisted = await readPersisted(session.id);
  return persisted.length > 0
    ? persisted
    : picked.map((q, i) => ({
        id: `${session.id}:${i}`,
        position: i,
        questionText: q.questionText,
      }));
}

/* -------------------------------------------------------------------------- */
/* Bank mode                                                                  */
/* -------------------------------------------------------------------------- */

async function pickBankQuestions(
  session: SessionConfig,
): Promise<PickedQuestion[]> {
  const cols = {
    id: bankQuestions.id,
    questionText: bankQuestions.questionText,
    idealAnswer: bankQuestions.idealAnswer,
    modality: bankQuestions.modality,
  };
  const base = and(
    eq(bankQuestions.roleId, session.jobRoleId),
    eq(bankQuestions.techStackId, session.techStackId),
    eq(bankQuestions.isActive, true),
  );

  // Bank questions this user has already been served (any past session). Used as
  // a subquery so the full history is never pulled into app memory; isNotNull
  // also keeps NOT IN well-behaved (a NULL in the set would zero out the match).
  const seenIds = db
    .select({ id: sessionQuestions.bankQuestionId })
    .from(sessionQuestions)
    .innerJoin(
      interviewSessions,
      eq(interviewSessions.id, sessionQuestions.sessionId),
    )
    .where(
      and(
        eq(interviewSessions.userId, session.userId),
        isNotNull(sessionQuestions.bankQuestionId),
      ),
    );

  // Prefer unseen questions, chosen at random, bounded to what the session needs
  // — selection happens in SQL so a large bank never loads wholesale.
  const picked = await db
    .select(cols)
    .from(bankQuestions)
    .where(and(base, notInArray(bankQuestions.id, seenIds)))
    .orderBy(sql`random()`)
    .limit(session.questionCount);

  // Exhausted the unseen pool? Top up with random repeats, never re-picking one
  // already chosen for this session.
  if (picked.length < session.questionCount) {
    const pickedIds = picked.map((q) => q.id);
    const topUp = await db
      .select(cols)
      .from(bankQuestions)
      .where(
        pickedIds.length
          ? and(base, notInArray(bankQuestions.id, pickedIds))
          : base,
      )
      .orderBy(sql`random()`)
      .limit(session.questionCount - picked.length);
    picked.push(...topUp);
  }

  if (picked.length === 0) {
    throw new QuestionGenerationError(
      "This role and tech stack has no question-bank questions yet. Ask an admin to add some, or try an AI interview.",
    );
  }

  return picked.map((q) => ({
    bankQuestionId: q.id,
    questionText: q.questionText,
    idealAnswer: q.idealAnswer,
    modality: q.modality,
  }));
}

/* -------------------------------------------------------------------------- */
/* AI mode (ephemeral — generated live, never cached)                         */
/* -------------------------------------------------------------------------- */

async function generateAiQuestions(
  session: SessionConfig,
): Promise<PickedQuestion[]> {
  // Per-user rate limit — kills accidental retry loops before any AI work.
  if (!allowAction(`gen:${session.userId}`)) {
    throw new QuestionGenerationError(
      "You're generating interviews too fast. Please wait a moment and try again.",
    );
  }

  // No cache to fall back on for AI mode — if the daily budget is spent we
  // can't degrade gracefully, so stop with a clear message.
  if (!(await reserveAiCalls(1))) {
    throw new QuestionGenerationError(
      "We've reached today's limit for AI-generated interviews. Please try a Question Bank interview, or come back tomorrow.",
    );
  }

  const ctx = await buildContext(session);
  const generated = await generateQuestions(ctx);

  return generated.slice(0, session.questionCount).map((g) => ({
    bankQuestionId: null,
    questionText: g.question_text,
    idealAnswer: g.ideal_answer,
    modality: "text" as const,
  }));
}

/** Assemble the Groq prompt context from the session + the user's profile. */
async function buildContext(
  session: SessionConfig,
): Promise<GenerationContext> {
  const [[role], [tech], [profile]] = await Promise.all([
    db
      .select({
        name: jobRoles.name,
        professionType: jobRoles.professionType,
      })
      .from(jobRoles)
      .where(eq(jobRoles.id, session.jobRoleId)),
    db
      .select({ name: techStacks.name })
      .from(techStacks)
      .where(eq(techStacks.id, session.techStackId)),
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
    skillLevel: session.skillLevel ?? "intermediate",
    count: session.questionCount,
    yearsExperience: profile?.years ?? 0,
    skills: Array.isArray(profile?.skills) ? (profile.skills as string[]) : [],
    targetRole: onboarding.targetRole ?? "",
    cvText: cvPlainText(profile?.cvText),
    userId: session.userId,
    professionType: role?.professionType ?? "technical",
  };
}

// Re-export so callers can catch generation failures cleanly.
export { QuestionGenerationError };
