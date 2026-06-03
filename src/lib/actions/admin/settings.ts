"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appSettings, db } from "@db";
import { requireAdmin } from "@/lib/session";
import { AI_FEATURE_KEYS } from "@/lib/ai/catalog";
import { zodError, type AdminResult } from "./util";

const timerPresetSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  // null = "No Timer". Capped at 2 hours.
  seconds: z.number().int().min(5).max(7200).nullable(),
});

const lengthPresetSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  questionCount: z.number().int().min(1).max(50),
});

const schema = z
  .object({
    timerPresets: z.array(timerPresetSchema).min(1).max(12),
    defaultTimerPresetId: z.string().trim().min(1),
    lengthPresets: z.array(lengthPresetSchema).min(1).max(8),
    defaultLengthPresetId: z.string().trim().min(1),
    // AI backend for interview answer scoring.
    scoringProvider: z.enum(["groq", "deepseek"]),
  })
  .superRefine((d, ctx) => {
    const timerIds = d.timerPresets.map((p) => p.id);
    const lengthIds = d.lengthPresets.map((p) => p.id);
    if (new Set(timerIds).size !== timerIds.length) {
      ctx.addIssue({ code: "custom", message: "Timer preset ids must be unique." });
    }
    if (new Set(lengthIds).size !== lengthIds.length) {
      ctx.addIssue({ code: "custom", message: "Length preset ids must be unique." });
    }
    if (!timerIds.includes(d.defaultTimerPresetId)) {
      ctx.addIssue({ code: "custom", message: "Default timer preset must be one of the presets." });
    }
    if (!lengthIds.includes(d.defaultLengthPresetId)) {
      ctx.addIssue({ code: "custom", message: "Default length preset must be one of the presets." });
    }
  });

export async function updateSettings(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  const {
    timerPresets,
    defaultTimerPresetId,
    lengthPresets,
    defaultLengthPresetId,
    scoringProvider,
  } = p.data;

  // Derive the legacy fields from the presets so older code paths (and any
  // pre-preset sessions) keep working without a separate admin control:
  //  - questionCounts = the distinct counts behind the length presets
  //  - defaultTimerSeconds = the default timer preset's seconds (or 120 when
  //    that default is "No Timer"/null), clamped to the legacy 10s minimum.
  const questionCounts = Array.from(
    new Set(lengthPresets.map((l) => l.questionCount)),
  )
    .sort((a, b) => a - b)
    .slice(0, 10);
  const defaultTimerPreset = timerPresets.find((t) => t.id === defaultTimerPresetId);
  const defaultTimerSeconds = Math.min(
    3600,
    Math.max(10, defaultTimerPreset?.seconds ?? 120),
  );

  try {
    await db
      .insert(appSettings)
      .values({
        id: "global",
        defaultTimerSeconds,
        questionCounts,
        timerPresets,
        defaultTimerPresetId,
        lengthPresets,
        defaultLengthPresetId,
        scoringProvider,
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          defaultTimerSeconds,
          questionCounts,
          timerPresets,
          defaultTimerPresetId,
          lengthPresets,
          defaultLengthPresetId,
          scoringProvider,
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

/* -------------------------------------------------------------------------- */
/* Per-feature AI model overrides (/admin/ai-models)                          */
/* -------------------------------------------------------------------------- */

const featureChoiceSchema = z.object({
  provider: z.enum(["groq", "deepseek"]),
  model: z.string().trim().min(1).max(120),
});

const featureModelsSchema = z
  .object({
    // featureKey → { provider, model }. Only known feature keys are accepted.
    featureModels: z.record(z.string(), featureChoiceSchema),
  })
  .superRefine((d, ctx) => {
    const known = new Set<string>(AI_FEATURE_KEYS);
    for (const key of Object.keys(d.featureModels)) {
      if (!known.has(key)) {
        ctx.addIssue({ code: "custom", message: `Unknown AI feature: ${key}` });
      }
    }
  });

/**
 * Save the per-feature model map. A feature omitted from the map falls back to
 * the global provider + tier default at call time, so clearing an entry simply
 * restores default behaviour. Upserts only the `feature_models` column, so it
 * never clobbers the timer/length/provider settings written by updateSettings.
 */
export async function updateFeatureModels(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = featureModelsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  try {
    await db
      .insert(appSettings)
      .values({ id: "global", featureModels: p.data.featureModels })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { featureModels: p.data.featureModels, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("[updateFeatureModels]", error);
    return { ok: false, error: "Could not save model settings." };
  }
  revalidatePath("/admin/ai-models");
  return { ok: true };
}
