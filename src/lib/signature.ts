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
 *
 * NOTE: editor `language` (javascript/typescript) is deliberately NOT part of
 * the signature. It is content-affecting for coding questions, but:
 *  - it is chosen by the model per-question (stored on questions_cache.language),
 *    not a fixed config input the caller supplies here, so it can't key the pool;
 *  - the `type: "coding"` discriminator already separates coding pools from text
 *    ones, and a mixed-language coding pool is acceptable (both js/ts are valid
 *    answers and the code-aware scorer is told the language per submission);
 *  - adding it would change the hash of EVERY existing cached signature,
 *    orphaning the current cache and forcing full regeneration.
 * If language ever becomes a caller-supplied, pool-defining input, add it to
 * SignatureParts and the canonical string below (and plan a cache migration).
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
