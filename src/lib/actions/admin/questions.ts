"use server";

import { revalidatePath } from "next/cache";
import { count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  focusAreas,
  jobRoles,
  questionsCache,
  sessionQuestions,
  techStacks,
} from "@db";
import { requireAdmin } from "@/lib/session";
import { computeSignature } from "@/lib/signature";
import {
  CODING_LANGUAGES,
  DEFAULT_CODING_LANGUAGE,
  generateQuestionBatch,
  QuestionGenerationError,
} from "@/lib/groq";
import { zodError, type AdminResult } from "./util";

/** Normalise question text for duplicate detection (matches the seed script). */
const normText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Language column for a row: coding rows get a language (default if unset),
 *  everything else is null. */
function languageFor(
  type: "text" | "coding",
  language?: string | null,
): string | null {
  return type === "coding" ? (language ?? DEFAULT_CODING_LANGUAGE) : null;
}

const createSchema = z.object({
  jobRoleId: z.string().uuid("Pick a role."),
  techStackId: z.string().uuid("Pick a tech stack."),
  focusAreaId: z.string().uuid("Pick a focus area."),
  difficulty: z.string().trim().min(1, "Difficulty is required.").max(40),
  // Interview type drives the signature (which pool this joins).
  interviewType: z.enum(["technical", "behavioral", "mixed", "coding"]),
  // Answering modality stored on the row.
  type: z.enum(["text", "coding"]),
  // Editor language — only meaningful for coding questions.
  language: z.enum(CODING_LANGUAGES).optional(),
  questionText: z.string().trim().min(1, "Question is required.").max(4000),
  idealAnswer: z.string().trim().min(1, "Ideal answer is required.").max(8000),
});

export async function createQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const d = p.data;

  const signature = computeSignature({
    jobRoleId: d.jobRoleId,
    techStackId: d.techStackId,
    focusAreaId: d.focusAreaId,
    difficulty: d.difficulty,
    type: d.interviewType,
  });

  try {
    await db.insert(questionsCache).values({
      jobRoleId: d.jobRoleId,
      techStackId: d.techStackId,
      focusAreaId: d.focusAreaId,
      difficulty: d.difficulty,
      type: d.type,
      language: languageFor(d.type, d.language),
      questionText: d.questionText,
      idealAnswer: d.idealAnswer,
      signature,
      source: "admin",
      isActive: true,
    });
  } catch (error) {
    console.error("[createQuestion]", error);
    return { ok: false, error: "Could not save the question." };
  }
  revalidatePath("/admin/questions");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  questionText: z.string().trim().min(1).max(4000),
  idealAnswer: z.string().trim().min(1).max(8000),
  type: z.enum(["text", "coding"]),
  language: z.enum(CODING_LANGUAGES).optional(),
  isActive: z.boolean(),
});

export async function updateQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { id, language, ...data } = p.data;
  await db
    .update(questionsCache)
    .set({ ...data, language: languageFor(data.type, language) })
    .where(eq(questionsCache.id, id));
  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function toggleQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), isActive: z.boolean() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid input." };
  await db
    .update(questionsCache)
    .set({ isActive: p.data.isActive })
    .where(eq(questionsCache.id, p.data.id));
  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function deleteQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid question." };

  const [{ n }] = await db
    .select({ n: count() })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.questionId, p.data.id));
  if (n > 0)
    return {
      ok: false,
      error: "This question is used in past sessions. Deactivate it instead.",
    };

  await db.delete(questionsCache).where(eq(questionsCache.id, p.data.id));
  revalidatePath("/admin/questions");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Bulk + power-user actions                                                  */
/* -------------------------------------------------------------------------- */

const idsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one question."),
});

/** Activate or deactivate every selected question in one update. */
export async function bulkSetActive(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = idsSchema
    .extend({ isActive: z.boolean() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  await db
    .update(questionsCache)
    .set({ isActive: p.data.isActive })
    .where(inArray(questionsCache.id, p.data.ids));
  revalidatePath("/admin/questions");
  return { ok: true };
}

/**
 * Delete selected questions. Questions referenced by past sessions are kept
 * (their history must stay intact) and reported back as skipped.
 */
export async function bulkDelete(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = idsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  // Which of the selected ids are referenced by a past session?
  const used = await db
    .select({ id: sessionQuestions.questionId })
    .from(sessionQuestions)
    .where(inArray(sessionQuestions.questionId, p.data.ids))
    .groupBy(sessionQuestions.questionId);

  const usedIds = new Set(used.map((u) => u.id));
  const deletable = p.data.ids.filter((id) => !usedIds.has(id));

  if (deletable.length > 0) {
    await db.delete(questionsCache).where(inArray(questionsCache.id, deletable));
  }

  revalidatePath("/admin/questions");
  if (usedIds.size > 0) {
    return {
      ok: true,
      error: `Deleted ${deletable.length}. Kept ${usedIds.size} used in past sessions — deactivate those instead.`,
    };
  }
  return { ok: true };
}

/** Clone a question into the same pool as a fresh, active admin-owned copy. */
export async function duplicateQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid question." };

  const [orig] = await db
    .select()
    .from(questionsCache)
    .where(eq(questionsCache.id, p.data.id));
  if (!orig) return { ok: false, error: "Question not found." };

  try {
    await db.insert(questionsCache).values({
      jobRoleId: orig.jobRoleId,
      techStackId: orig.techStackId,
      focusAreaId: orig.focusAreaId,
      difficulty: orig.difficulty,
      type: orig.type,
      language: orig.language,
      questionText: `${orig.questionText} (copy)`,
      idealAnswer: orig.idealAnswer,
      signature: orig.signature,
      source: "admin",
      isActive: true,
    });
  } catch (error) {
    console.error("[duplicateQuestion]", error);
    return { ok: false, error: "Could not duplicate the question." };
  }
  revalidatePath("/admin/questions");
  return { ok: true };
}

const generateSchema = z.object({
  jobRoleId: z.string().uuid("Pick a role."),
  techStackId: z.string().uuid("Pick a tech stack."),
  focusAreaId: z.string().uuid("Pick a focus area."),
  difficulty: z.string().trim().min(1, "Pick a difficulty.").max(40),
  interviewType: z.enum(["technical", "behavioral", "mixed", "coding"]),
  count: z.number().int().min(1).max(20),
});

/**
 * Generate N more questions for one exact config and write them into the bank
 * (source = 'ai'). Skips any the model returns that duplicate an existing
 * question in the same pool. Returns how many were actually inserted.
 */
export async function generateForConfig(
  input: unknown,
): Promise<AdminResult & { inserted?: number }> {
  await requireAdmin();
  const p = generateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const d = p.data;

  const signature = computeSignature({
    jobRoleId: d.jobRoleId,
    techStackId: d.techStackId,
    focusAreaId: d.focusAreaId,
    difficulty: d.difficulty,
    type: d.interviewType,
  });

  // Names for the prompt + existing pool for dedupe.
  const [[role], [tech], [focus], existing] = await Promise.all([
    db.select({ name: jobRoles.name }).from(jobRoles).where(eq(jobRoles.id, d.jobRoleId)),
    db.select({ name: techStacks.name }).from(techStacks).where(eq(techStacks.id, d.techStackId)),
    db.select({ name: focusAreas.name }).from(focusAreas).where(eq(focusAreas.id, d.focusAreaId)),
    db
      .select({ questionText: questionsCache.questionText })
      .from(questionsCache)
      .where(eq(questionsCache.signature, signature)),
  ]);

  const seen = new Set(existing.map((e) => normText(e.questionText)));

  let generated;
  try {
    generated = await generateQuestionBatch({
      roleName: role?.name ?? "Software Developer",
      techStack: tech?.name ?? "General",
      focusArea: focus?.name ?? "General",
      difficulty: d.difficulty,
      interviewType: d.interviewType,
      count: d.count,
      avoid: Array.from(seen).slice(0, 60),
    });
  } catch (error) {
    const message =
      error instanceof QuestionGenerationError
        ? error.message
        : "We couldn't generate questions right now. Please try again.";
    return { ok: false, error: message };
  }

  const fresh = generated.filter((g) => {
    const key = normText(g.question_text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (fresh.length === 0) {
    return { ok: false, error: "The model only returned duplicates. Try again." };
  }

  const isCoding = d.interviewType === "coding";
  await db.insert(questionsCache).values(
    fresh.map((g) => ({
      jobRoleId: d.jobRoleId,
      techStackId: d.techStackId,
      focusAreaId: d.focusAreaId,
      difficulty: d.difficulty,
      type: isCoding ? ("coding" as const) : ("text" as const),
      language: isCoding ? (g.language ?? DEFAULT_CODING_LANGUAGE) : null,
      questionText: g.question_text,
      idealAnswer: g.ideal_answer,
      signature,
      source: "ai" as const,
      isActive: true,
    })),
  );

  revalidatePath("/admin/questions");
  return { ok: true, inserted: fresh.length };
}
