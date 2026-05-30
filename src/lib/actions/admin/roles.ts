"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  difficultyBands,
  focusAreas,
  interviewSessions,
  jobRoles,
  questionsCache,
  techStacks,
} from "@db";
import { requireAdmin } from "@/lib/session";
import { isUniqueViolation, zodError, type AdminResult } from "./util";

const roleSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only."),
  description: z.string().trim().max(500).optional().default(""),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

export async function createRole(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodError(parsed) };

  try {
    await db.insert(jobRoles).values({
      ...parsed.data,
      description: parsed.data.description || null,
    });
  } catch (error) {
    if (isUniqueViolation(error))
      return { ok: false, error: "A role with that slug already exists." };
    console.error("[createRole]", error);
    return { ok: false, error: "Could not create the role." };
  }
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function updateRole(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = roleSchema.extend({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: zodError(parsed) };
  const { id, ...data } = parsed.data;

  try {
    await db
      .update(jobRoles)
      .set({ ...data, description: data.description || null })
      .where(eq(jobRoles.id, id));
  } catch (error) {
    if (isUniqueViolation(error))
      return { ok: false, error: "A role with that slug already exists." };
    console.error("[updateRole]", error);
    return { ok: false, error: "Could not update the role." };
  }
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function deleteRole(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid role." };
  const { id } = parsed.data;

  // Block deletes that would orphan dependent data.
  const checks: [string, typeof focusAreas | typeof techStacks][] = [
    ["focus areas", focusAreas],
    ["tech stacks", techStacks],
  ];
  for (const [label, table] of checks) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(table)
      .where(eq(table.jobRoleId, id));
    if (n > 0)
      return {
        ok: false,
        error: `This role still has ${label}. Remove them (or deactivate the role) first.`,
      };
  }
  const [{ n: bands }] = await db
    .select({ n: count() })
    .from(difficultyBands)
    .where(eq(difficultyBands.jobRoleId, id));
  if (bands > 0)
    return {
      ok: false,
      error: "This role still has difficulty bands. Remove them first.",
    };
  const [{ n: qs }] = await db
    .select({ n: count() })
    .from(questionsCache)
    .where(eq(questionsCache.jobRoleId, id));
  const [{ n: sessions }] = await db
    .select({ n: count() })
    .from(interviewSessions)
    .where(eq(interviewSessions.jobRoleId, id));
  if (qs > 0 || sessions > 0)
    return {
      ok: false,
      error:
        "This role has questions or interview sessions. Deactivate it instead of deleting.",
    };

  try {
    await db.delete(jobRoles).where(eq(jobRoles.id, id));
  } catch (error) {
    console.error("[deleteRole]", error);
    return { ok: false, error: "Could not delete the role." };
  }
  revalidatePath("/admin/roles");
  return { ok: true };
}
