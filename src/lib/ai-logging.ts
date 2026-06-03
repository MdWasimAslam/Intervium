import "server-only";
import { aiUsageLog, db } from "@db";

/** The features that make Groq calls — used as the `feature` log dimension. */
export type AiFeature =
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

/** Human-readable labels for the dashboard (keep in sync with AiFeature). */
export const AI_FEATURE_LABELS: Record<string, string> = {
  question_gen: "Interview question generation",
  scoring_text: "Interview scoring (text)",
  scoring_code: "Interview scoring (code)",
  summary_gen: "Summary generation",
  cv_match: "Resume analysis",
  cv_ats: "Resume ATS review",
  cv_import: "Resume import / parse",
  cv_optimize: "Resume optimization",
  cover_letter_gen: "Cover letter generation",
  gap_analysis: "Gap analysis",
  dojo_hint: "Code Dojo hint",
  dojo_generate: "Code Dojo question generation",
  dojo_review: "Code Dojo solution review",
};

export interface AiCallLog {
  userId?: string | null;
  feature: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  status?: "success" | "error";
}

/**
 * Record one Groq call for the admin AI Usage dashboard. Fire-and-forget and
 * fully best-effort: a logging failure must never break (or slow) the AI work
 * it's recording, so all errors are swallowed with a warning.
 */
export async function logAiCall(entry: AiCallLog): Promise<void> {
  try {
    await db.insert(aiUsageLog).values({
      userId: entry.userId ?? null,
      feature: entry.feature,
      model: entry.model,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      totalTokens: entry.totalTokens ?? null,
      status: entry.status ?? "success",
    });
  } catch (error) {
    console.warn("[ai-logging] failed (non-fatal):", error);
  }
}
