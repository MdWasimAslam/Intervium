"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, difficultyBands } from "@db";
import { requireAdmin } from "@/lib/session";
import { isUniqueViolation, zodError, type AdminResult } from "./util";

const schema = z
  .object({
    jobRoleId: z.string().uuid("Pick a role."),
    label: z.string().trim().min(1, "Label is required.").max(40),
    minYears: z.number().int().min(0).max(99),
    maxYears: z.number().int().min(0).max(99),
  })
  .refine((v) => v.minYears <= v.maxYears, {
    message: "Min years must be ≤ max years.",
    path: ["maxYears"],
  });
const withId = z
  .object({
    id: z.string().uuid(),
    jobRoleId: z.string().uuid(),
    label: z.string().trim().min(1).max(40),
    minYears: z.number().int().min(0).max(99),
    maxYears: z.number().int().min(0).max(99),
  })
  .refine((v) => v.minYears <= v.maxYears, {
    message: "Min years must be ≤ max years.",
    path: ["maxYears"],
  });

/** Reject a band whose [min,max] overlaps another band for the same role. */
async function overlaps(
  jobRoleId: string,
  minYears: number,
  maxYears: number,
  excludeId?: string,
): Promise<boolean> {
  const existing = await db
    .select()
    .from(difficultyBands)
    .where(eq(difficultyBands.jobRoleId, jobRoleId));
  return existing.some(
    (b) =>
      b.id !== excludeId &&
      minYears <= (b.maxYears ?? 99) &&
      maxYears >= (b.minYears ?? 0),
  );
}

export async function createBand(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  if (await overlaps(p.data.jobRoleId, p.data.minYears, p.data.maxYears))
    return {
      ok: false,
      error: "This range overlaps an existing band for this role.",
    };
  try {
    await db.insert(difficultyBands).values(p.data);
  } catch (error) {
    // Backstops the overlap check against races: the DB enforces one label
    // per role.
    if (isUniqueViolation(error))
      return { ok: false, error: "A band with that label already exists." };
    console.error("[createBand]", error);
    return { ok: false, error: "Could not create the band." };
  }
  revalidatePath("/admin/difficulty");
  return { ok: true };
}

export async function updateBand(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = withId.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };
  const { id, ...data } = p.data;
  if (await overlaps(data.jobRoleId, data.minYears, data.maxYears, id))
    return {
      ok: false,
      error: "This range overlaps an existing band for this role.",
    };
  try {
    await db
      .update(difficultyBands)
      .set(data)
      .where(eq(difficultyBands.id, id));
  } catch (error) {
    if (isUniqueViolation(error))
      return { ok: false, error: "A band with that label already exists." };
    console.error("[updateBand]", error);
    return { ok: false, error: "Could not update the band." };
  }
  revalidatePath("/admin/difficulty");
  return { ok: true };
}

export async function deleteBand(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid band." };
  await db.delete(difficultyBands).where(eq(difficultyBands.id, p.data.id));
  revalidatePath("/admin/difficulty");
  return { ok: true };
}
