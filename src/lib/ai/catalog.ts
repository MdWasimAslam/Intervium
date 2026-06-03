/**
 * AI model catalog + feature registry (pure data — no imports, so both the
 * client and the settings layer can depend on it without a cycle).
 *
 * The admin "AI Models" screen lets an admin pick which model each AI feature
 * runs on. A feature with no entry falls back to the global provider + its tier
 * default (today's behaviour), so this is purely additive.
 */

/** AI backends the HTTP client speaks (both use the OpenAI chat-completions wire format). */
export type AiProvider = "groq" | "deepseek";

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  groq: "Groq",
  deepseek: "DeepSeek",
};

/** A curated, known-good model. The admin can also enter a custom id, so this
 *  list is a convenience shortlist, not a hard limit. */
export interface ModelOption {
  provider: AiProvider;
  model: string;
  label: string;
}

export const MODEL_CATALOG: ModelOption[] = [
  // Groq
  { provider: "groq", model: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant — fast & cheap" },
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile — balanced" },
  { provider: "groq", model: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { provider: "groq", model: "openai/gpt-oss-120b", label: "GPT-OSS 120B — strongest" },
  // DeepSeek
  { provider: "deepseek", model: "deepseek-chat", label: "DeepSeek Chat (V3)" },
  { provider: "deepseek", model: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
];

/** A per-feature model choice persisted in app settings. */
export interface FeatureModelChoice {
  provider: AiProvider;
  model: string;
}

/** Map of feature key → chosen model. A missing key = use the default. */
export type FeatureModels = Record<string, FeatureModelChoice>;

/** Canonical key for each AI capability — must match the `feature` label passed
 *  at the call site (and the AI-usage log dimension). */
export type AiFeatureKey =
  | "question_gen"
  | "scoring_text"
  | "scoring_code"
  | "summary_gen"
  | "cv_match"
  | "cv_ats"
  | "cv_import"
  | "cv_optimize"
  | "cover_letter_gen"
  | "gap_analysis"
  | "dojo_hint"
  | "dojo_generate"
  | "dojo_review";

export interface AiFeatureDef {
  key: AiFeatureKey;
  label: string;
  group: string;
  /** What runs when no model is chosen for this feature. */
  defaultHint: string;
}

/**
 * Every configurable AI capability, grouped for the admin UI. The default for
 * `question_gen` is Groq's fast model; every other feature follows the global
 * provider's "smart" tier (the historical `scoringProvider` setting).
 */
export const AI_FEATURES: AiFeatureDef[] = [
  { key: "question_gen", label: "Interview question generation", group: "Interview", defaultHint: "Default: Groq fast model" },
  { key: "scoring_text", label: "Answer scoring (text)", group: "Interview", defaultHint: "Default: global provider (smart)" },
  { key: "scoring_code", label: "Answer scoring (code)", group: "Interview", defaultHint: "Default: global provider (smart)" },
  { key: "summary_gen", label: "Results summary", group: "Interview", defaultHint: "Default: global provider (smart)" },
  { key: "cv_match", label: "CV ↔ job match", group: "CV", defaultHint: "Default: global provider (smart)" },
  { key: "cv_ats", label: "CV ATS review", group: "CV", defaultHint: "Default: global provider (smart)" },
  { key: "cv_import", label: "CV import / parse", group: "CV", defaultHint: "Default: global provider (smart)" },
  { key: "cv_optimize", label: "CV optimization", group: "CV", defaultHint: "Default: global provider (smart)" },
  { key: "cover_letter_gen", label: "Cover letter", group: "CV", defaultHint: "Default: global provider (smart)" },
  { key: "gap_analysis", label: "Gap analysis", group: "Insights", defaultHint: "Default: global provider (smart)" },
  { key: "dojo_hint", label: "Dojo hints", group: "Code Dojo", defaultHint: "Default: global provider (smart)" },
  { key: "dojo_generate", label: "Dojo problem generation", group: "Code Dojo", defaultHint: "Default: global provider (smart)" },
  { key: "dojo_review", label: "Dojo solution review", group: "Code Dojo", defaultHint: "Default: global provider (smart)" },
];

export const AI_FEATURE_KEYS: AiFeatureKey[] = AI_FEATURES.map((f) => f.key);

/** Validate a stored/incoming feature-models map, dropping malformed entries. */
export function sanitizeFeatureModels(value: unknown): FeatureModels {
  if (!value || typeof value !== "object") return {};
  const known = new Set<string>(AI_FEATURE_KEYS);
  const out: FeatureModels = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!known.has(key) || !raw || typeof raw !== "object") continue;
    const { provider, model } = raw as { provider?: unknown; model?: unknown };
    if (
      (provider === "groq" || provider === "deepseek") &&
      typeof model === "string" &&
      model.trim()
    ) {
      out[key] = { provider, model: model.trim() };
    }
  }
  return out;
}
