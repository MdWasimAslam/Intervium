"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { accessCodes, db } from "@db";
import { requireAdmin } from "@/lib/session";
import { zodError, type AdminResult } from "./util";

const genSchema = z.object({
  count: z.number().int().min(1).max(100),
  expiresInDays: z.number().int().min(0).max(3650).optional(),
});

function newCode(): string {
  return `INTV-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Generate one or many access codes, optionally with an expiry. */
export async function generateCodes(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = genSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  const { count, expiresInDays } = p.data;
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

  const rows = Array.from({ length: count }, () => ({
    code: newCode(),
    createdBy: admin.id,
    expiresAt,
  }));

  try {
    await db.insert(accessCodes).values(rows).onConflictDoNothing();
  } catch (error) {
    console.error("[generateCodes]", error);
    return { ok: false, error: "Could not generate codes." };
  }
  revalidatePath("/admin/access-codes");
  return { ok: true };
}

/** Delete an unused code. Used codes are preserved for audit. */
export async function deleteCode(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid code." };

  const [code] = await db
    .select({ isUsed: accessCodes.isUsed })
    .from(accessCodes)
    .where(eq(accessCodes.id, p.data.id));
  if (!code) return { ok: false, error: "Code not found." };
  if (code.isUsed) return { ok: false, error: "Used codes can't be deleted." };

  await db.delete(accessCodes).where(eq(accessCodes.id, p.data.id));
  revalidatePath("/admin/access-codes");
  return { ok: true };
}
