"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  dojoAttempts,
  dojoProgress,
  dojoQuestions,
  dojoQuestionTopics,
} from "@db";
import { withTransaction } from "@db/tx";
import { requireAdmin } from "@/lib/session";
import { resolveTopicIds, setQuestionTopics } from "@/lib/dojo/topics";
import {
  importDojoFileSchema,
  importDojoQuestions as importDojoQuestionsService,
  type DojoImportReport,
} from "@/lib/dojo/import";
import { isUniqueViolation, zodError, type AdminResult } from "./util";

const testCaseSchema = z.object({
  input: z.array(z.unknown()),
  expected: z.unknown(),
  hidden: z.boolean().optional(),
});

const fields = {
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers and hyphens only."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  prompt: z.string().trim().min(1, "Prompt is required.").max(8000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  fnName: z
    .string()
    .trim()
    .min(1, "Function name is required.")
    .max(80)
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "Function name must be a valid identifier."),
  starterCode: z.string().min(1, "Starter code is required.").max(20000),
  testCases: z.array(testCaseSchema).min(1, "Add at least one test case."),
  // Topic NAMES (existing or new); resolved to topic rows by slug.
  topics: z.array(z.string().trim().min(1)).max(12),
};

const createSchema = z.object(fields);

export async function createDojoQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { topics, ...q } = p.data;

  try {
    const [row] = await db
      .insert(dojoQuestions)
      .values({
        slug: q.slug,
        title: q.title,
        prompt: q.prompt,
        difficulty: q.difficulty,
        fnName: q.fnName,
        starterCode: q.starterCode,
        testCases: q.testCases,
        isActive: true,
      })
      .returning({ id: dojoQuestions.id });
    await setQuestionTopics(row.id, await resolveTopicIds(topics));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `A question with slug "${q.slug}" already exists.` };
    }
    console.error("[createDojoQuestion]", error);
    return { ok: false, error: "Could not save the question." };
  }

  revalidatePath("/admin/dojo");
  revalidatePath("/dojo");
  return { ok: true };
}

const updateSchema = z.object({
  ...fields,
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export async function updateDojoQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { id, topics, ...q } = p.data;

  try {
    await db
      .update(dojoQuestions)
      .set({
        slug: q.slug,
        title: q.title,
        prompt: q.prompt,
        difficulty: q.difficulty,
        fnName: q.fnName,
        starterCode: q.starterCode,
        testCases: q.testCases,
        isActive: q.isActive,
      })
      .where(eq(dojoQuestions.id, id));
    await setQuestionTopics(id, await resolveTopicIds(topics));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `A question with slug "${q.slug}" already exists.` };
    }
    console.error("[updateDojoQuestion]", error);
    return { ok: false, error: "Could not update the question." };
  }

  revalidatePath("/admin/dojo");
  revalidatePath("/dojo");
  return { ok: true };
}

export async function toggleDojoQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), isActive: z.boolean() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid input." };
  await db
    .update(dojoQuestions)
    .set({ isActive: p.data.isActive })
    .where(eq(dojoQuestions.id, p.data.id));
  revalidatePath("/admin/dojo");
  revalidatePath("/dojo");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* JSON import (built-in problems, matched/deduped by slug)                    */
/* -------------------------------------------------------------------------- */

const importInputSchema = z.object({
  json: z.string().min(1, "Paste some JSON first."),
  dryRun: z.boolean(),
});

export async function importDojoQuestionsFromJson(
  input: unknown,
): Promise<AdminResult & { report?: DojoImportReport }> {
  await requireAdmin();
  const p = importInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  let raw: unknown;
  try {
    raw = JSON.parse(p.data.json);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }

  // Accept a single problem object or an array of them.
  const arr = Array.isArray(raw) ? raw : [raw];
  const parsed = importDojoFileSchema.safeParse(arr);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "(root)";
    return {
      ok: false,
      error: `Validation failed at ${path}: ${issue?.message ?? "invalid format"}`,
    };
  }

  try {
    const report = await importDojoQuestionsService(parsed.data, {
      dryRun: p.data.dryRun,
    });
    if (!p.data.dryRun) {
      revalidatePath("/admin/dojo");
      revalidatePath("/dojo");
    }
    return { ok: true, report };
  } catch (error) {
    console.error("[importDojoQuestionsFromJson]", error);
    return { ok: false, error: "Import failed. Please check the data and retry." };
  }
}

export async function deleteDojoQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid question." };
  const { id } = p.data;

  // Keep questions that learners have already practised — their attempt history
  // and review schedule reference them. Deactivate those instead.
  const [{ n }] = await db
    .select({ n: count() })
    .from(dojoAttempts)
    .where(eq(dojoAttempts.questionId, id));
  const [{ n: p2 }] = await db
    .select({ n: count() })
    .from(dojoProgress)
    .where(eq(dojoProgress.questionId, id));
  if (n > 0 || p2 > 0) {
    return {
      ok: false,
      error: "This question has practice history. Deactivate it instead of deleting.",
    };
  }

  await withTransaction(async (tx) => {
    await tx
      .delete(dojoQuestionTopics)
      .where(eq(dojoQuestionTopics.questionId, id));
    await tx.delete(dojoQuestions).where(eq(dojoQuestions.id, id));
  });

  revalidatePath("/admin/dojo");
  revalidatePath("/dojo");
  return { ok: true };
}
