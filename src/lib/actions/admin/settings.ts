"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appSettings, db } from "@db";
import { requireAdmin } from "@/lib/session";
import { zodError, type AdminResult } from "./util";

const schema = z.object({
  defaultTimerSeconds: z.number().int().min(10).max(3600),
  questionCounts: z
    .array(z.number().int().min(1).max(50))
    .min(1, "At least one question count is required.")
    .max(10),
});

export async function updateSettings(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  // Normalise counts: unique + ascending.
  const questionCounts = Array.from(new Set(p.data.questionCounts)).sort(
    (a, b) => a - b,
  );

  try {
    await db
      .insert(appSettings)
      .values({ id: "global", ...p.data, questionCounts })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          defaultTimerSeconds: p.data.defaultTimerSeconds,
          questionCounts,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[updateSettings]", error);
    return { ok: false, error: "Could not save settings." };
  }
  revalidatePath("/admin/settings");
  return { ok: true };
}
