import { createHash } from "crypto";

/**
 * Inputs that uniquely identify a question pool.
 *
 * `type` here is the *interview type* (technical / behavioral / mixed) — it is
 * what determines the content of the questions, so it must be part of the
 * cache key. (The `questions_cache.type` column, by contrast, records the
 * answering modality — text/voice/either — and is not part of this hash.)
 */
export interface SignatureParts {
  jobRoleId: string;
  techStackId: string;
  focusAreaId: string;
  difficulty: string;
  type: "technical" | "behavioral" | "mixed" | "coding";
}

/**
 * Build a deterministic SHA-256 signature for a question pool. Identical
 * configs always produce the same signature, regardless of call order.
 */
export function computeSignature(parts: SignatureParts): string {
  const canonical = [
    parts.jobRoleId,
    parts.techStackId,
    parts.focusAreaId,
    parts.difficulty.trim().toLowerCase(),
    parts.type,
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}
