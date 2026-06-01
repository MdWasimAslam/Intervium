/**
 * Order-preserving merge of the optimizer's AI output back onto the original CV.
 *
 * The optimizer is free to reorder, drop, duplicate, or pad entries — none of
 * which we want. So we NEVER trust the AI's array structure. Instead we treat
 * the AI output as a bag of *text improvements* and graft them onto the
 * original ordered arrays:
 *
 *   - structure, order, and counts always come from the ORIGINAL,
 *   - reworded summary / descriptions / bullets come from the AI (matched by a
 *     stable key, with an index fallback when counts line up),
 *   - bullets are capped to the original count (the AI may reword, not add),
 *   - contact facts, dates, companies, degrees, etc. are kept verbatim,
 *   - skills are the original ∪ any AI skill that maps to a missing JD keyword,
 *     de-duplicated.
 *
 * Result: structure ⊆ the original (which already validated), so the downstream
 * `cvSchema` re-validation effectively cannot fail on count/order grounds.
 * Pure & deterministic.
 */
import { dedupePreserveOrder } from "./parse";
import {
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvProject,
} from "./types";

/** Stable, case-insensitive, whitespace-collapsed match key. */
function keyOf(parts: Array<string | undefined>): string {
  return parts
    .map((p) => (p ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

/**
 * For each original item (in order), find its AI counterpart: first by stable
 * key, else — only when the two arrays are the same length — by index position
 * (handles the AI lightly editing the key field). Returns AI item or undefined.
 */
function aligner<T>(
  original: T[],
  ai: T[],
  key: (item: T) => string,
): (origItem: T, index: number) => T | undefined {
  const byKey = new Map<string, T>();
  for (const item of ai) {
    const k = key(item);
    if (k && !byKey.has(k)) byKey.set(k, item);
  }
  const sameLength = original.length === ai.length;
  return (origItem, index) => byKey.get(key(origItem)) ?? (sameLength ? ai[index] : undefined);
}

const text = (improved: unknown, original: string): string =>
  typeof improved === "string" && improved.trim() ? improved : original;

export function mergeOptimizedCv(
  original: CvData,
  ai: CvData,
  missing: string[] = [],
): CvData {
  // Experience: keep original head facts; take AI description + reworded bullets.
  const matchExp = aligner<CvExperience>(
    original.experience,
    ai.experience ?? [],
    (e) => keyOf([e.company, e.title, e.period]),
  );
  const experience = original.experience.map((orig, i) => {
    const m = matchExp(orig, i);
    const bullets = orig.bullets.map((b, j) =>
      text(m?.bullets?.[j], b),
    );
    return {
      ...orig,
      description: text(m?.description, orig.description),
      bullets,
    };
  });

  // Projects: keep name/url; take AI description.
  const matchProj = aligner<CvProject>(
    original.projects,
    ai.projects ?? [],
    (p) => keyOf([p.name]),
  );
  const projects = original.projects.map((orig, i) => {
    const m = matchProj(orig, i);
    return { ...orig, description: text(m?.description, orig.description) };
  });

  // Education: keep facts; allow only the free-text `details` to be reworded.
  const matchEdu = aligner<CvEducation>(
    original.education,
    ai.education ?? [],
    (e) => keyOf([e.degree, e.institution]),
  );
  const education = original.education.map((orig, i) => {
    const m = matchEdu(orig, i);
    return { ...orig, details: text(m?.details, orig.details) };
  });

  // Skills: original first, then AI skills that map to a missing JD keyword.
  const missingLower = missing.map((m) => m.toLowerCase());
  const aiSkills = (ai.skills ?? []).filter((sk) => {
    const lower = sk.toLowerCase();
    return missingLower.some((m) => lower.includes(m) || m.includes(lower));
  });
  const skills = dedupePreserveOrder([...original.skills, ...aiSkills]);

  return {
    // Contact facts are never AI-sourced; accept only a reworded title.
    contact: { ...original.contact, title: text(ai.contact?.title, original.contact.title) },
    summary: text(ai.summary, original.summary),
    experience,
    projects,
    skills,
    education,
    // Certifications & languages: no upside to AI rewording — keep verbatim.
    certifications: original.certifications,
    languages: original.languages,
  };
}
