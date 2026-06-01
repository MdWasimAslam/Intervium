"use server";

import { revalidatePath } from "next/cache";
import { count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { bankQuestions, db, sessionQuestions } from "@db";
import { requireAdmin } from "@/lib/session";
import {
  importFileSchema,
  importQuestions as importQuestionsService,
  type ImportReport,
} from "@/lib/questions/import";
import { zodError, type AdminResult } from "./util";

const fields = {
  roleId: z.string().uuid("Pick a role."),
  techStackId: z.string().uuid("Pick a tech stack."),
  category: z.enum(["technical", "behavioral"]),
  modality: z.enum(["text", "coding"]),
  questionText: z.string().trim().min(1, "Question is required.").max(4000),
  idealAnswer: z.string().trim().min(1, "Ideal answer is required.").max(8000),
};

const createSchema = z.object(fields);

export async function createQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  try {
    await db.insert(bankQuestions).values({ ...p.data, isActive: true });
  } catch (error) {
    console.error("[createQuestion]", error);
    return { ok: false, error: "Could not save the question." };
  }
  revalidatePath("/admin/questions");
  return { ok: true };
}

const updateSchema = z.object({
  ...fields,
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export async function updateQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { id, ...data } = p.data;
  await db.update(bankQuestions).set(data).where(eq(bankQuestions.id, id));
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
    .update(bankQuestions)
    .set({ isActive: p.data.isActive })
    .where(eq(bankQuestions.id, p.data.id));
  revalidatePath("/admin/questions");
  return { ok: true };
}

/** How many transcripts still reference these bank questions. */
async function referencedIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const used = await db
    .select({ id: sessionQuestions.bankQuestionId })
    .from(sessionQuestions)
    .where(inArray(sessionQuestions.bankQuestionId, ids))
    .groupBy(sessionQuestions.bankQuestionId);
  return new Set(used.map((u) => u.id).filter((id): id is string => !!id));
}

export async function deleteQuestion(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid question." };

  const [{ n }] = await db
    .select({ n: count() })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.bankQuestionId, p.data.id));
  if (n > 0)
    return {
      ok: false,
      error: "This question is used in past sessions. Deactivate it instead.",
    };

  await db.delete(bankQuestions).where(eq(bankQuestions.id, p.data.id));
  revalidatePath("/admin/questions");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Bulk actions                                                               */
/* -------------------------------------------------------------------------- */

const idsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one question."),
});

export async function bulkSetActive(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = idsSchema.extend({ isActive: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  await db
    .update(bankQuestions)
    .set({ isActive: p.data.isActive })
    .where(inArray(bankQuestions.id, p.data.ids));
  revalidatePath("/admin/questions");
  return { ok: true };
}

/**
 * Delete the selected questions. Ones referenced by past sessions are kept
 * (their transcripts must stay intact) and reported back as skipped.
 */
export async function bulkDelete(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = idsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  const usedIds = await referencedIds(p.data.ids);
  const deletable = p.data.ids.filter((id) => !usedIds.has(id));
  if (deletable.length > 0) {
    await db.delete(bankQuestions).where(inArray(bankQuestions.id, deletable));
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

/* -------------------------------------------------------------------------- */
/* JSON import (shared service — same engine as the CLI loader)               */
/* -------------------------------------------------------------------------- */

const importInputSchema = z.object({
  json: z.string().min(1, "Paste some JSON first."),
  dryRun: z.boolean(),
});

export async function importQuestionsFromJson(
  input: unknown,
): Promise<AdminResult & { report?: ImportReport }> {
  await requireAdmin();
  const p = importInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  let raw: unknown;
  try {
    raw = JSON.parse(p.data.json);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }

  const parsed = importFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "(root)";
    return {
      ok: false,
      error: `Validation failed at ${path}: ${issue?.message ?? "invalid format"}`,
    };
  }

  try {
    const report = await importQuestionsService(db, parsed.data, {
      dryRun: p.data.dryRun,
    });
    if (!p.data.dryRun) revalidatePath("/admin/questions");
    return { ok: true, report };
  } catch (error) {
    console.error("[importQuestionsFromJson]", error);
    return { ok: false, error: "Import failed. Please check the data and retry." };
  }
}
