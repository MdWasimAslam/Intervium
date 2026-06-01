import "server-only";

/**
 * Groq per-model rate limits (the four dimensions Groq enforces) and helpers
 * to resolve them. This is a read-only reference: the values are dictated by
 * Groq's free-tier table and rarely change, so they live in code rather than
 * the DB. Override any model's limits without a redeploy via the
 * `GROQ_MODEL_LIMITS` env var (a JSON object of model name -> partial limits).
 */

/** The four rate-limit dimensions Groq applies, per model. */
export interface ModelLimits {
  /** Requests per minute. */
  rpm: number;
  /** Requests per day (resets 00:00 UTC). */
  rpd: number;
  /** Tokens per minute. */
  tpm: number;
  /** Tokens per day (resets 00:00 UTC). */
  tpd: number;
}

/** The role a model plays in the app — mirrors the tiers in `src/lib/groq.ts`. */
export type ModelRole = "fast" | "smart";

/**
 * Resolved model names. These MUST match the tier resolution in
 * `src/lib/groq.ts` so the dashboard reports on the models actually called.
 */
export const FAST_MODEL =
  process.env.GROQ_FAST_MODEL?.trim() || "llama-3.1-8b-instant";
export const SMART_MODEL =
  process.env.GROQ_SMART_MODEL?.trim() || "llama-3.3-70b-versatile";

/**
 * Groq free-tier limits, transcribed from the console rate-limit table. Only
 * the models the app actually calls are listed; others fall through to
 * `getModelLimits() === null` (usage still renders, just without limit bars).
 */
const BASE_LIMITS: Record<string, ModelLimits> = {
  "llama-3.1-8b-instant": { rpm: 30, rpd: 14_400, tpm: 6_000, tpd: 500_000 },
  "llama-3.3-70b-versatile": { rpm: 30, rpd: 1_000, tpm: 12_000, tpd: 100_000 },
};

/** Parse the optional `GROQ_MODEL_LIMITS` JSON override; ignore if malformed. */
function envOverrides(): Record<string, Partial<ModelLimits>> {
  const raw = process.env.GROQ_MODEL_LIMITS?.trim();
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, Partial<ModelLimits>>)
      : {};
  } catch {
    console.warn("[ai-limits] GROQ_MODEL_LIMITS is not valid JSON; ignoring.");
    return {};
  }
}

const isFullLimits = (o: Partial<ModelLimits>): o is ModelLimits =>
  typeof o.rpm === "number" &&
  typeof o.rpd === "number" &&
  typeof o.tpm === "number" &&
  typeof o.tpd === "number";

/**
 * Resolve the rate limits for a model, applying any env override on top of the
 * built-in reference. Returns `null` for an unknown model with no (complete)
 * override, so callers can render usage without a budget bar.
 */
export function getModelLimits(model: string): ModelLimits | null {
  const base = BASE_LIMITS[model];
  const override = envOverrides()[model];

  if (!base) {
    // Allow a fully-specified override for an env-swapped, unlisted model.
    return override && isFullLimits(override) ? override : null;
  }

  return {
    rpm: override?.rpm ?? base.rpm,
    rpd: override?.rpd ?? base.rpd,
    tpm: override?.tpm ?? base.tpm,
    tpd: override?.tpd ?? base.tpd,
  };
}

/**
 * The distinct models the app calls, with their role. Deduplicated so a config
 * where fast and smart resolve to the same model reports it once.
 */
export const IN_USE_MODELS: { model: string; role: ModelRole }[] = (() => {
  const out: { model: string; role: ModelRole }[] = [];
  for (const entry of [
    { model: FAST_MODEL, role: "fast" as const },
    { model: SMART_MODEL, role: "smart" as const },
  ]) {
    if (!out.some((m) => m.model === entry.model)) out.push(entry);
  }
  return out;
})();
