"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  focusAreas,
  interviewSessions,
  questionsCache,
  techStacks,
} from "@db";
import { requireAdmin } from "@/lib/session";
import { zodError, type AdminResult } from "./util";

const schema = z.object({
  jobRoleId: z.string().uuid("Pick a role."),
  name: z.string().trim().min(1, "Name is required.").max(80),
  isActive: z.boolean(),
});
const withId = schema.extend({ id: z.string().uuid() });

/* ----------------------------- Focus areas ------------------------------- */

export async function createFocus(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  await db.insert(focusAreas).values(p.data);
  revalidatePath("/admin/focus-areas");
  return { ok: true };
}

export async function updateFocus(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = withId.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { id, ...data } = p.data;
  await db.update(focusAreas).set(data).where(eq(focusAreas.id, id));
  revalidatePath("/admin/focus-areas");
  return { ok: true };
}

export async function deleteFocus(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid item." };
  const { id } = p.data;

  const [{ n: qs }] = await db
    .select({ n: count() })
    .from(questionsCache)
    .where(eq(questionsCache.focusAreaId, id));
  const [{ n: ses }] = await db
    .select({ n: count() })
    .from(interviewSessions)
    .where(eq(interviewSessions.focusAreaId, id));
  if (qs > 0 || ses > 0)
    return {
      ok: false,
      error:
        "This focus area is used by questions or sessions. Deactivate it instead.",
    };

  await db.delete(focusAreas).where(eq(focusAreas.id, id));
  revalidatePath("/admin/focus-areas");
  return { ok: true };
}

/* ------------------------------ Tech stacks ------------------------------ */

export async function createTech(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  await db.insert(techStacks).values(p.data);
  revalidatePath("/admin/tech-stacks");
  return { ok: true };
}

export async function updateTech(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = withId.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { id, ...data } = p.data;
  await db.update(techStacks).set(data).where(eq(techStacks.id, id));
  revalidatePath("/admin/tech-stacks");
  return { ok: true };
}

export async function deleteTech(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid item." };
  const { id } = p.data;

  const [{ n: qs }] = await db
    .select({ n: count() })
    .from(questionsCache)
    .where(eq(questionsCache.techStackId, id));
  const [{ n: ses }] = await db
    .select({ n: count() })
    .from(interviewSessions)
    .where(eq(interviewSessions.techStackId, id));
  if (qs > 0 || ses > 0)
    return {
      ok: false,
      error:
        "This tech stack is used by questions or sessions. Deactivate it instead.",
    };

  await db.delete(techStacks).where(eq(techStacks.id, id));
  revalidatePath("/admin/tech-stacks");
  return { ok: true };
}
