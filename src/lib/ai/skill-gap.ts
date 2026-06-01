import { z } from "zod";
import { generateJson } from "./client";

/* --- (e) Resume-vs-interview gap analysis (Feature 3) -------------------- */

const gapReportSchema = z.object({
  summary: z.string().trim().min(1),
  /** Skills the candidate claims AND has demonstrated in interviews. */
  validatedSkills: z.array(z.string().trim().min(1)).max(20),
  /** Claimed but untested or weakly-demonstrated skills. */
  unvalidatedSkills: z.array(z.string().trim().min(1)).max(20),
  strengths: z.array(z.string().trim().min(1)).max(10),
  weakAreas: z.array(z.string().trim().min(1)).max(10),
  /** Ordered, concrete next steps. */
  learningPath: z.array(z.string().trim().min(1)).min(1).max(10),
});

export type GapReport = z.infer<typeof gapReportSchema>;

export interface GapAnalysisContext {
  /** Skills the user lists on their profile/CV (perceived skills). */
  resumeSkills: string[];
  /** Demonstrated interview performance per specialization (0-100). */
  tested: { name: string; avgScore: number; sessionCount: number }[];
}

/**
 * ONE Groq call: compare claimed skills against demonstrated interview
 * performance and produce a gap report + learning path. Grounded strictly in
 * the provided data — it must not invent skills or scores.
 */
export async function analyzeSkillGap(
  ctx: GapAnalysisContext,
  userId?: string | null,
): Promise<GapReport> {
  const perf = ctx.tested
    .map(
      (t) =>
        `- ${t.name}: ${t.avgScore}% average over ${t.sessionCount} interview(s)`,
    )
    .join("\n");
  return generateJson(
    gapReportSchema,
    (strict) =>
      [
        `You are a career coach comparing a candidate's CLAIMED skills against their DEMONSTRATED interview performance.`,
        ``,
        `Claimed skills (from their profile/CV): ${ctx.resumeSkills.length ? ctx.resumeSkills.join(", ") : "(none listed)"}`,
        ``,
        `Demonstrated interview performance by specialization (average score out of 100):`,
        perf,
        ``,
        `Interpret scores as: 70%+ strong/validated, 50-69% partial, below 50% weak. A claimed skill with no matching interview is "unvalidated" (untested).`,
        `Be honest and specific; ground every point ONLY in the data above. Do not invent skills, specializations, or numbers.`,
        ``,
        `Return a JSON object with:`,
        `- "summary": 1-2 sentences on the overall gap between perceived and demonstrated skill`,
        `- "validatedSkills": claimed skills clearly backed by strong interview performance (may be empty)`,
        `- "unvalidatedSkills": claimed skills that are untested or only weakly demonstrated (may be empty)`,
        `- "strengths": the candidate's strongest demonstrated areas`,
        `- "weakAreas": specializations scoring below 60% that need work`,
        `- "learningPath": 3-6 concrete, ordered next steps to close the biggest gaps`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object with exactly those keys. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    {
      temperature: 0.4,
      label: "gap-analysis",
      feature: "gap_analysis",
      userId,
    },
  );
}
