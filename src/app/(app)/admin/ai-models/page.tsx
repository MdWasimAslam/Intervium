import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getSettings, type ScoringProvider } from "@/lib/settings";
import {
  FAST_MODEL,
  SMART_MODEL,
  DEEPSEEK_DEFAULT_MODEL,
} from "@/lib/ai/client";
import {
  AI_FEATURES,
  type FeatureModelChoice,
} from "@/lib/ai/catalog";
import { AiModelsAdmin } from "@/components/admin/AiModelsAdmin";

export const metadata: Metadata = { title: "AI Models" };

/**
 * The concrete provider + model a feature runs on when it has no override —
 * mirrors `resolveFeatureModel` + the client's tier/env resolution so the admin
 * UI can show what "Default" actually means instead of just the word "Default".
 */
function defaultModelFor(
  featureKey: string,
  scoringProvider: ScoringProvider,
): FeatureModelChoice {
  const provider = featureKey === "question_gen" ? "groq" : scoringProvider;
  if (provider === "deepseek") {
    return {
      provider,
      model: process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL,
    };
  }
  // Groq: question generation uses the cheap "fast" tier; everything else "smart".
  return {
    provider,
    model: featureKey === "question_gen" ? FAST_MODEL : SMART_MODEL,
  };
}

export default async function AdminAiModelsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const defaults: Record<string, FeatureModelChoice> = {};
  for (const f of AI_FEATURES) {
    defaults[f.key] = defaultModelFor(f.key, settings.scoringProvider);
  }
  return (
    <AiModelsAdmin
      featureModels={settings.featureModels}
      scoringProvider={settings.scoringProvider}
      defaults={defaults}
    />
  );
}
