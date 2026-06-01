import { z } from "zod";
import { type CvData } from "@/lib/cv/types";
import { fnv1a, stableStringify } from "@/lib/cv/parse";
import { getAiProvider } from "@/lib/settings";
import {
  getModel,
  generateJson,
  CvAiError,
  SMART_MODEL,
  DEEPSEEK_DEFAULT_MODEL,
} from "./client";

/**
 * The model id the CV features run on (the active provider's "smart" tier).
 * Folded into the CV AI cache key so a model upgrade — or an admin switching
 * the AI provider (Groq ↔ DeepSeek) — transparently invalidates stale cached
 * output. Resolved without throwing so cache keying never breaks the request
 * even when the selected provider is unconfigured.
 */
export async function cvAiModelId(): Promise<string> {
  const provider = await getAiProvider();
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL;
  }
  return SMART_MODEL;
}

/** Derive a stable 32-bit integer seed from a CV feature's canonical input. */
function seedFrom(...inputs: unknown[]): number {
  return parseInt(fnv1a(stableStringify(inputs)), 16);
}

/* --- (b) AI job-match analysis ------------------------------------------- */

const matchAnalysisSchema = z.object({
  // AI's holistic fit estimate — complements the deterministic keyword score.
  // The fit LEVEL is derived from this number deterministically in the UI
  // (fitLevelFromScore), so the model no longer self-reports a level.
  fitScore: z.number().int().min(0).max(100),
  verdict: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).max(8),
  gaps: z.array(z.string().trim().min(1)).max(8),
  suggestions: z.array(z.string().trim().min(1)).min(1).max(8),
});

export type CvMatchAnalysis = z.infer<typeof matchAnalysisSchema>;

export interface MatchAnalysisContext {
  jobDescription: string;
  cvText: string;
  matched: string[];
  missing: string[];
  /** The deterministic in-app keyword score, given to the model for context. */
  keywordScore: number;
}

/**
 * ONE Groq call: a holistic, semantic analysis of how well the CV matches
 * the job — beyond literal keyword overlap. Returns an AI fit estimate, a
 * verdict, aligned strengths, genuine gaps, and actionable suggestions.
 */
export async function analyzeJobMatch(
  ctx: MatchAnalysisContext,
  userId?: string | null,
): Promise<CvMatchAnalysis> {
  return generateJson(
    matchAnalysisSchema,
    (strict) =>
      [
        `You are an expert technical recruiter evaluating how well a candidate's CV matches a specific job.`,
        `Judge the SEMANTIC fit — transferable experience, seniority, domain, and responsibilities — not just literal keyword overlap. Be honest, specific, and CONSERVATIVE; reference what the CV actually shows.`,
        ``,
        `Job description:`,
        `"""${ctx.jobDescription.slice(0, 4000)}"""`,
        ``,
        `Candidate CV:`,
        `"""${ctx.cvText.slice(0, 4000)}"""`,
        ``,
        `For context, an in-app keyword-overlap score is ${ctx.keywordScore}%.`,
        ctx.matched.length
          ? `Keywords already covered: ${ctx.matched.join(", ")}`
          : ``,
        ctx.missing.length
          ? `JD keywords missing from the CV: ${ctx.missing.join(", ")}`
          : ``,
        `Use the keyword data only as a hint. Your fitScore should generally sit AT OR BELOW the keyword-overlap score, unless the CV shows clear, evidenced experience the keywords missed.`,
        ``,
        `Score with this rubric — strong matches are RARE:`,
        `- 85-100: every important/required skill present AND strong, relevant, recent experience.`,
        `- 70-84: all important skills present; competitive; only minor gaps.`,
        `- 55-69: most important skills present, but with notable gaps.`,
        `- 40-54: several important skills or requirements missing.`,
        `- 0-39: core requirements absent.`,
        `Deduct meaningfully for EACH missing important skill. Do NOT default to 70+: a score of 70 or above requires that NO important requirement is missing. Most real candidates fall between 40 and 65.`,
        ``,
        `Return a JSON object with:`,
        `- "fitScore": integer 0-100 following the rubric above — your honest, conservative assessment of suitability for THIS role`,
        `- "verdict": 1-2 sentence honest summary of the match`,
        `- "strengths": 2-5 short phrases on where the candidate genuinely aligns with the role`,
        `- "gaps": 1-5 short phrases on meaningful gaps or risks (may be empty if none)`,
        `- "suggestions": 4-7 specific, actionable sentences to improve alignment and phrasing. Never invent experience the candidate lacks; suggest how to surface relevant truth.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object with exactly those keys. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    {
      temperature: 0,
      seed: seedFrom("cv-match", ctx.cvText, ctx.jobDescription),
      label: "cv-match",
      feature: "cv_match",
      userId,
    },
  );
}

/* --- (b2) AI ATS review (no job description) ----------------------------- */

// Qualitative ONLY. The numeric ATS score is computed deterministically in-app
// (`atsReadinessScore` in cv/ats.ts) — the model no longer self-reports a number
// or level, which is what made the score fluctuate between identical runs.
const atsReviewSchema = z.object({
  remarks: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).max(8),
  issues: z.array(z.string().trim().min(1)).max(8),
  suggestions: z.array(z.string().trim().min(1)).min(1).max(8),
});

export type CvAtsReview = z.infer<typeof atsReviewSchema>;

/**
 * ONE Groq call: review a CV for ATS-readiness and overall quality WITHOUT a
 * target job description. Returns an ATS score, an honest level + remarks,
 * what's working, what hurts ATS parsing/quality, and actionable fixes.
 */
export async function analyzeCvAts(
  cvText: string,
  userId?: string | null,
): Promise<CvAtsReview> {
  return generateJson(
    atsReviewSchema,
    (strict) =>
      [
        `You are an expert resume reviewer and Applicant Tracking System (ATS) specialist.`,
        `Evaluate the following CV for ATS-friendliness and overall quality. There is NO target job description — judge it as a general CV the candidate would submit to companies.`,
        ``,
        `Candidate CV (JSON):`,
        `"""${cvText.slice(0, 4000)}"""`,
        ``,
        `Assess: parseability (standard sections, clear structure, dates, contact info), content quality (strong action verbs, quantified impact, relevant skills), completeness, and clarity. Be honest and specific; reference what the CV actually shows.`,
        ``,
        `Return a JSON object with:`,
        `- "remarks": 1-2 sentence honest, encouraging summary of the CV's ATS-readiness`,
        `- "strengths": 2-5 short phrases on what the CV does well`,
        `- "issues": 0-6 short phrases on concrete problems that hurt ATS parsing or quality (may be empty if none)`,
        `- "suggestions": 3-7 specific, actionable sentences to improve the CV. Never invent experience the candidate lacks; suggest how to surface relevant truth.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object with exactly those keys. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    {
      temperature: 0,
      seed: seedFrom("cv-ats", cvText),
      label: "cv-ats",
      feature: "cv_ats",
      userId,
    },
  );
}

/* --- (c) Optimized CV rewrite -------------------------------------------- */

const optimizedCvSchema = z.object({
  contact: z.object({
    name: z.string(),
    title: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(z.string()),
  }),
  summary: z.string(),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      period: z.string(),
      link: z.string(),
      description: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      description: z.string(),
    }),
  ),
  skills: z.array(z.string()),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      period: z.string(),
      details: z.string(),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string(),
      url: z.string(),
    }),
  ),
  languages: z.array(z.string()),
});

/**
 * ONE Groq call: parse raw résumé text (e.g. extracted from an uploaded PDF)
 * into a structured `CvData`. Faithful extraction only — it never invents
 * employers, titles, dates, skills, or contact details; absent fields stay
 * empty. Returns the same shape as `CvData`.
 */
export async function extractCvFromText(
  resumeText: string,
  userId?: string | null,
): Promise<CvData> {
  return generateJson<CvData>(
    optimizedCvSchema,
    (strict) =>
      [
        `You are a precise résumé parser. Convert the résumé text below into structured JSON.`,
        `Use ONLY information actually present in the text — never invent or guess employers, titles, dates, skills, links, or contact details. Leave a field as an empty string or empty array when the text doesn't provide it.`,
        `Keep wording faithful to the source; you may lightly tidy obvious line-break artifacts, but do not embellish.`,
        ``,
        `Résumé text:`,
        `"""${resumeText.slice(0, 12000)}"""`,
        ``,
        `Return a JSON object with exactly these keys: "contact" {name,title,email,phone,location,links[]}, "summary", "experience" [{title,company,period,link,description,bullets[]}], "projects" [{name,url,description}], "skills" [], "education" [{degree,institution,period,details}], "certifications" [{name,issuer,url}], "languages" []. Include every key even if its value is an empty array or string.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    {
      temperature: 0,
      seed: seedFrom("cv-import", resumeText),
      label: "cv-import",
      feature: "cv_import",
      userId,
    },
  );
}

export interface OptimizeContext {
  jobDescription: string;
  cv: CvData;
  missing: string[];
}

/**
 * ONE Groq call: rewrite the CV to be more ATS-friendly for the JD.
 * Returns a full structured CV (same shape as `CvData`). Truthful — it
 * rephrases and surfaces relevant keywords, it does not fabricate experience.
 */
export async function optimizeCvForJob(
  ctx: OptimizeContext,
  userId?: string | null,
): Promise<CvData> {
  return generateJson<CvData>(
    optimizedCvSchema,
    (strict) =>
      [
        `You are an expert CV writer optimizing a CV for Applicant Tracking Systems (ATS) and a specific job.`,
        ``,
        `Job description:`,
        `"""${ctx.jobDescription.slice(0, 4000)}"""`,
        ``,
        `Current CV (JSON):`,
        JSON.stringify(ctx.cv),
        ``,
        ctx.missing.length
          ? `JD keywords currently missing — weave in any the candidate plausibly has, using their real experience: ${ctx.missing.join(", ")}`
          : ``,
        ``,
        `Rules:`,
        `- Keep ALL facts truthful. Do NOT invent employers, titles, dates, degrees, projects, certifications, or experience.`,
        `- Strengthen phrasing: lead with strong action verbs, quantify impact where the original implies it, and naturally incorporate relevant JD terminology into the summary, role descriptions, and bullets.`,
        `- Preserve the contact details, title, company names, periods, links, projects, education, certifications, and languages. You may reword descriptions but must not drop any section or entry.`,
        `- Keep experience, projects, and education entries in the SAME ORDER and the SAME COUNT as the input. Keep the same number of bullets per role — reword them, do not add or remove bullets.`,
        `- Keep it concise and professional.`,
        ``,
        `Return the FULL improved CV as a JSON object with exactly these keys: "contact" {name,title,email,phone,location,links[]}, "summary", "experience" [{title,company,period,link,description,bullets[]}], "projects" [{name,url,description}], "skills" [], "education" [{degree,institution,period,details}], "certifications" [{name,issuer,url}], "languages" []. Include every key even if its value is an empty array or string.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    {
      temperature: 0,
      seed: seedFrom("cv-optimize", ctx.cv, ctx.jobDescription),
      label: "cv-optimize",
      feature: "cv_optimize",
      userId,
    },
  );
}

/* --- (d) Cover letter generation (Feature 9) ----------------------------- */

export type CoverLetterType = "generic" | "job_specific" | "company_specific";

export interface CoverLetterContext {
  letterType: CoverLetterType;
  /** Candidate CV as plain text — the only source of truth for facts. */
  cvText: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
}

function coverLetterPrompt(ctx: CoverLetterContext): string {
  const cv = (ctx.cvText || "").slice(0, 4000);
  const parts = [
    `You are an expert career writer composing a professional, ready-to-send cover letter for a candidate.`,
    ``,
    `Candidate CV (use ONLY real facts from here — never invent employers, titles, dates, or skills):`,
    `"""${cv || "(no CV provided)"}"""`,
    ``,
  ];
  if (ctx.letterType !== "generic") {
    if (ctx.jobTitle) parts.push(`Target role: ${ctx.jobTitle}`);
    if (ctx.companyName) parts.push(`Company: ${ctx.companyName}`);
    if (ctx.jobDescription)
      parts.push(
        `Job description:`,
        `"""${ctx.jobDescription.slice(0, 4000)}"""`,
      );
    parts.push(``);
  }
  const focus =
    ctx.letterType === "generic"
      ? `Write a versatile, role-agnostic cover letter the candidate can adapt to many applications.`
      : ctx.letterType === "job_specific"
        ? `Tailor the letter tightly to the target role and job description: mirror the key requirements with the candidate's real, relevant experience.`
        : `Tailor the letter to the specific company and role: reflect the company's likely priorities and connect the candidate's real strengths to them.`;

  parts.push(
    focus,
    ``,
    `Rules:`,
    `- Truthful: use only experience evident in the CV; do NOT fabricate anything.`,
    `- 3-4 tight paragraphs, roughly 250-350 words, confident and specific (no generic filler).`,
    `- Open with a strong hook, demonstrate fit in the body, close with a clear call to action.`,
    `- If the company or role is unknown, write naturally — never leave bracketed placeholders like [Company].`,
    `- Plain text only: no markdown, no bullet points, no headings. You may begin with "Dear Hiring Manager," when no specific contact is known.`,
    `- Do NOT add a closing salutation, sign-off, signature, or the candidate's name/contact at the end — end after the final body paragraph. A signature block is appended automatically.`,
    `Output ONLY the cover letter body text.`,
  );
  return parts.filter(Boolean).join("\n");
}

/**
 * Generate a cover letter (plain text). Throws {@link CvAiError} on
 * network/quota failure or an empty response.
 */
export async function generateCoverLetter(
  ctx: CoverLetterContext,
  userId?: string | null,
): Promise<string> {
  const model = getModel({
    json: false,
    temperature: 0.6,
    tier: "smart",
    provider: await getAiProvider(),
    feature: "cover_letter_gen",
    userId,
  });
  try {
    const text = (await model.generateContent(coverLetterPrompt(ctx))).trim();
    if (!text) {
      throw new CvAiError(
        "The AI returned an empty cover letter. Please try again.",
      );
    }
    return text;
  } catch (error) {
    if (error instanceof CvAiError) throw error;
    console.error("[groq:cover-letter] failed:", error);
    throw new CvAiError(
      "We couldn't generate the cover letter right now. Please try again.",
    );
  }
}
