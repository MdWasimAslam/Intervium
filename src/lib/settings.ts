import { eq } from "drizzle-orm";
import {
  appSettings,
  db,
  type LengthPreset,
  type TimerPreset,
} from "@db";
import {
  type AiProvider,
  type FeatureModels,
  sanitizeFeatureModels,
} from "@/lib/ai/catalog";

/** AI backend that grades interview answers. */
export type ScoringProvider = "groq" | "deepseek";

export interface AppSettings {
  /** Legacy fallback timer for sessions created before presets existed. */
  defaultTimerSeconds: number;
  /** Legacy raw counts, derived from lengthPresets; kept for back-compat. */
  questionCounts: number[];
  timerPresets: TimerPreset[];
  defaultTimerPresetId: string;
  lengthPresets: LengthPreset[];
  defaultLengthPresetId: string;
  /** Which provider grades interview answers ("groq" by default). */
  scoringProvider: ScoringProvider;
  /** Per-feature model overrides; empty = every feature uses the default. */
  featureModels: FeatureModels;
}

/** The sentinel preset id for a user-entered custom timer duration. */
export const CUSTOM_TIMER_ID = "custom";

const DEFAULT_TIMER_PRESETS: TimerPreset[] = [
  { id: "no-timer", label: "No Timer", seconds: null },
  { id: "1min", label: "1 min", seconds: 60 },
  { id: "2min", label: "2 min", seconds: 120 },
  { id: "3min", label: "3 min", seconds: 180 },
  { id: "5min", label: "5 min", seconds: 300 },
  { id: "10min", label: "10 min", seconds: 600 },
];

const DEFAULT_LENGTH_PRESETS: LengthPreset[] = [
  { id: "quick", label: "Quick", questionCount: 5 },
  { id: "standard", label: "Standard", questionCount: 10 },
  { id: "full", label: "Full", questionCount: 20 },
];

const DEFAULTS: AppSettings = {
  defaultTimerSeconds: 120,
  questionCounts: [3, 5, 10],
  timerPresets: DEFAULT_TIMER_PRESETS,
  defaultTimerPresetId: "no-timer",
  lengthPresets: DEFAULT_LENGTH_PRESETS,
  defaultLengthPresetId: "standard",
  scoringProvider: "groq",
  featureModels: {},
};

/**
 * Read the global app settings, creating the single row with defaults on
 * first access. Falls back to in-code defaults if the DB is unreachable or a
 * column is empty (so a half-migrated row never breaks interview setup).
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, "global"));

    if (!row) {
      await db
        .insert(appSettings)
        .values({ id: "global" })
        .onConflictDoNothing();
      return DEFAULTS;
    }

    const timerPresets =
      Array.isArray(row.timerPresets) && row.timerPresets.length
        ? row.timerPresets
        : DEFAULTS.timerPresets;
    const lengthPresets =
      Array.isArray(row.lengthPresets) && row.lengthPresets.length
        ? row.lengthPresets
        : DEFAULTS.lengthPresets;

    return {
      defaultTimerSeconds: row.defaultTimerSeconds,
      questionCounts:
        Array.isArray(row.questionCounts) && row.questionCounts.length
          ? row.questionCounts
          : DEFAULTS.questionCounts,
      timerPresets,
      defaultTimerPresetId: row.defaultTimerPresetId || DEFAULTS.defaultTimerPresetId,
      lengthPresets,
      defaultLengthPresetId:
        row.defaultLengthPresetId || DEFAULTS.defaultLengthPresetId,
      // Validate against the known set so an unexpected value can't be sent to
      // the AI layer; anything else falls back to Groq.
      scoringProvider: row.scoringProvider === "deepseek" ? "deepseek" : "groq",
      // Drop any malformed/unknown entries so a bad row can never reach the AI layer.
      featureModels: sanitizeFeatureModels(row.featureModels),
    };
  } catch (error) {
    console.error("[getSettings]", error);
    return DEFAULTS;
  }
}

/**
 * The admin-selected AI backend for every "smart"-tier model call — interview
 * grading, result summaries, and all CV / Code-Dojo AI features. (The cheap
 * "fast" tier used for interview question generation always stays on Groq.)
 * Stored under the historical `scoringProvider` column; the name predates the
 * setting governing all AI, not just scoring. Falls back to Groq on any error.
 */
export async function getAiProvider(): Promise<ScoringProvider> {
  return (await getSettings()).scoringProvider;
}

/** The provider + (optional) model a single AI call should use. */
export interface ResolvedModel {
  provider: AiProvider;
  /** An explicit model id, or undefined to let the client use its tier default. */
  model?: string;
}

/**
 * Resolve which provider + model a given AI feature runs on:
 *  1. an admin per-feature override (from the AI Models screen), else
 *  2. `fallbackProvider` if the caller supplies one (e.g. scoring passes the
 *     global provider it already read), else
 *  3. Groq for question generation (always cheap/fast), else the global
 *     `scoringProvider`.
 * When no model is returned, the client falls back to that provider's tier
 * default — so an unset feature behaves exactly as before this setting existed.
 */
export async function resolveFeatureModel(
  feature: string | undefined,
  opts: { fallbackProvider?: AiProvider } = {},
): Promise<ResolvedModel> {
  const settings = await getSettings();
  const override = feature ? settings.featureModels[feature] : undefined;
  if (override?.model) {
    return { provider: override.provider, model: override.model };
  }
  const provider =
    opts.fallbackProvider ??
    (feature === "question_gen" ? "groq" : settings.scoringProvider);
  return { provider };
}

/**
 * Resolve the per-question timer seconds for a chosen preset (or a custom
 * value). Returns `null` for "No Timer" / an unknown preset, so callers treat
 * a missing/invalid choice as un-timed rather than crashing.
 */
export function timerSecondsForPreset(
  settings: AppSettings,
  presetId: string | null | undefined,
  customSeconds?: number | null,
): number | null {
  if (!presetId) return null;
  if (presetId === CUSTOM_TIMER_ID) {
    return customSeconds && customSeconds > 0 ? customSeconds : null;
  }
  const preset = settings.timerPresets.find((p) => p.id === presetId);
  return preset ? preset.seconds : null;
}

/** Resolve the question count for a chosen length preset, or null if unknown. */
export function questionCountForPreset(
  settings: AppSettings,
  presetId: string | null | undefined,
): number | null {
  if (!presetId) return null;
  const preset = settings.lengthPresets.find((p) => p.id === presetId);
  return preset ? preset.questionCount : null;
}
