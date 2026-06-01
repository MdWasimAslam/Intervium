"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { coverLetters, db, profiles } from "@db";
import { getCurrentUser } from "@/lib/session";
import { allowAction } from "@/lib/rate-limit";
import type { Result } from "@/lib/actions/result";
import {
  cvFingerprint,
  cvPlainText,
  parseStoredCv,
  serializeCv,
} from "@/lib/cv/parse";
import { analyzeMatch, atsReadinessScore, atsLevelFromScore } from "@/lib/cv/ats";
import { ARR_MAX, STR_MAX } from "@/lib/cv/limits";
import { normalizeCv } from "@/lib/cv/normalize";
import { mergeOptimizedCv } from "@/lib/cv/merge";
import { getCachedCvResult, putCachedCvResult } from "@/lib/cv/cache";
import {
  type AtsReviewSnapshot,
  type CvData,
  type StoredAtsReview,
} from "@/lib/cv/types";
import {
  analyzeCvAts,
  analyzeJobMatch,
  type CoverLetterType,
  type CvAtsReview,
  type CvMatchAnalysis,
  CvAiError,
  extractCvFromText,
  generateCoverLetter,
  optimizeCvForJob,
} from "@/lib/groq";

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const cvSchema = z.object({
  contact: z.object({
    name: z.string().max(STR_MAX.name),
    title: z.string().max(STR_MAX.title),
    email: z.string().max(STR_MAX.email),
    phone: z.string().max(STR_MAX.phone),
    location: z.string().max(STR_MAX.location),
    links: z.array(z.string().max(STR_MAX.link)).max(ARR_MAX.links),
  }),
  summary: z.string().max(STR_MAX.summary),
  experience: z
    .array(
      z.object({
        title: z.string().max(STR_MAX.expTitle),
        company: z.string().max(STR_MAX.expCompany),
        period: z.string().max(STR_MAX.expPeriod),
        link: z.string().max(STR_MAX.link),
        description: z.string().max(STR_MAX.expDescription),
        bullets: z.array(z.string().max(STR_MAX.bullet)).max(ARR_MAX.bullets),
      }),
    )
    .max(ARR_MAX.experience),
  projects: z
    .array(
      z.object({
        name: z.string().max(STR_MAX.projectName),
        url: z.string().max(STR_MAX.projectUrl),
        description: z.string().max(STR_MAX.projectDescription),
      }),
    )
    .max(ARR_MAX.projects),
  skills: z.array(z.string().max(STR_MAX.skill)).max(ARR_MAX.skills),
  education: z
    .array(
      z.object({
        degree: z.string().max(STR_MAX.eduDegree),
        institution: z.string().max(STR_MAX.eduInstitution),
        period: z.string().max(STR_MAX.eduPeriod),
        details: z.string().max(STR_MAX.eduDetails),
      }),
    )
    .max(ARR_MAX.education),
  certifications: z
    .array(
      z.object({
        name: z.string().max(STR_MAX.certName),
        issuer: z.string().max(STR_MAX.certIssuer),
        url: z.string().max(STR_MAX.certUrl),
      }),
    )
    .max(ARR_MAX.certifications),
  languages: z.array(z.string().max(STR_MAX.language)).max(ARR_MAX.languages),
});

const jdSchema = z.string().trim().min(1).max(8000);

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

/** Load the user's stored CV, parsed into structured `CvData`. */
export async function getPrimaryCvAction(): Promise<Result<CvData>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  try {
    const [row] = await db
      .select({ cvText: profiles.cvText, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!row?.cvText) return { ok: false, error: "No CV on file yet." };

    const cv = parseStoredCv(row.cvText);
    if (!cv.contact.name && row.displayName) cv.contact.name = row.displayName;
    return { ok: true, data: cv };
  } catch (error) {
    console.error("[getPrimaryCvAction]", error);
    return { ok: false, error: "Could not load your CV. Please try again." };
  }
}

/** Persist the edited CV back to `profiles.cv_text` as a JSON envelope. */
export async function saveCv(data: CvData): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid CV.",
    };
  }

  try {
    const result = await db
      .update(profiles)
      .set({ cvText: serializeCv(parsed.data), updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));
    // No profile row means onboarding hasn't created one yet — there's nothing
    // to attach the CV to, so don't claim a save that didn't happen.
    if (result.rowCount === 0) {
      return {
        ok: false,
        error: "Finish onboarding before saving your CV.",
      };
    }
    return { ok: true, data: true };
  } catch (error) {
    console.error("[saveCv]", error);
    return { ok: false, error: "Could not save your CV. Please try again." };
  }
}

/** (b) ONE Groq call: holistic AI analysis of the CV↔JD match. */
export async function analyzeJobMatchAction(
  jobDescription: string,
  cv: CvData,
): Promise<Result<CvMatchAnalysis>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const jd = jdSchema.safeParse(jobDescription);
  const parsedCv = cvSchema.safeParse(cv);
  if (!jd.success || !parsedCv.success) {
    return { ok: false, error: "Please provide a job description first." };
  }

  if (!allowAction(`cv-match:${user.id}`, 8, 60_000)) {
    return {
      ok: false,
      error: "You're going a bit fast — try again in a minute.",
    };
  }

  // Reuse the in-app match so the AI gets concrete keyword context.
  const { score, matched, missing } = analyzeMatch(parsedCv.data, jd.data);
  // matched/missing/score are a pure function of (cv, jd), so the cache key is.
  const cacheInput = { cv: parsedCv.data, jd: jd.data };

  try {
    const cached = await getCachedCvResult<CvMatchAnalysis>(
      "cv_match",
      cacheInput,
    );
    const analysis =
      cached ??
      (await analyzeJobMatch(
        {
          jobDescription: jd.data,
          cvText: JSON.stringify(parsedCv.data),
          matched,
          missing,
          keywordScore: score,
        },
        user.id,
      ));
    if (!cached) await putCachedCvResult("cv_match", cacheInput, analysis);
    return { ok: true, data: analysis };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not analyze the match.";
    return { ok: false, error: msg };
  }
}

/**
 * ONE Groq call: turn raw résumé text (extracted from an uploaded PDF, in the
 * browser) into structured `CvData`. The client extracts the text and sends it
 * here; the PDF itself never reaches the server.
 */
export async function importCvFromTextAction(
  resumeText: string,
): Promise<Result<CvData>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const text = (resumeText ?? "").trim();
  if (text.length < 30) {
    return { ok: false, error: "Couldn't find enough text to read a CV from." };
  }
  if (!allowAction(`cv-import:${user.id}`, 6, 60_000)) {
    return {
      ok: false,
      error: "You're going a bit fast — try again in a minute.",
    };
  }

  const clipped = text.slice(0, 16000);
  try {
    const cached = await getCachedCvResult<CvData>("cv_import", {
      resumeText: clipped,
    });
    if (cached) return { ok: true, data: cached };

    const aiOut = await extractCvFromText(clipped, user.id);
    // Clamp/dedup before validation so over-long AI output degrades gracefully
    // instead of hard-failing. normalizeCv guarantees within-bounds, so the
    // safeParse should always pass; fall back to the normalized CV if not.
    const cv = normalizeCv(aiOut);
    const safe = cvSchema.safeParse(cv);
    if (!safe.success) {
      console.error(
        "[importCvFromTextAction] post-normalize parse failed (non-fatal):",
        safe.error.issues[0],
      );
    }
    const result = safe.success ? safe.data : cv;
    await putCachedCvResult("cv_import", { resumeText: clipped }, result);
    return { ok: true, data: result };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not read your CV. Please try again.";
    return { ok: false, error: msg };
  }
}

/**
 * ONE Groq call: AI ATS review of the CV on its own (no job description). The
 * latest review is persisted on the user's profile (score, full review, a CV
 * fingerprint for staleness, and a timestamp) so it survives reloads and a
 * re-check overwrites it. Persistence is best-effort — a DB write failure never
 * hides the freshly-computed result from the user.
 */
export async function analyzeCvAtsAction(
  cv: CvData,
): Promise<Result<AtsReviewSnapshot>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsedCv = cvSchema.safeParse(cv);
  if (!parsedCv.success) {
    return {
      ok: false,
      error: "Your CV looks incomplete — add a few details first.",
    };
  }

  if (!allowAction(`cv-ats:${user.id}`, 8, 60_000)) {
    return {
      ok: false,
      error: "You're going a bit fast — try again in a minute.",
    };
  }

  // The AI now returns only qualitative feedback (remarks/strengths/issues/
  // suggestions); the NUMBER is computed deterministically below, so it's stable
  // for identical input and moves sensibly as the CV is edited.
  let qualitative: CvAtsReview;
  try {
    const cached = await getCachedCvResult<CvAtsReview>("cv_ats", {
      cv: parsedCv.data,
    });
    qualitative =
      cached ?? (await analyzeCvAts(JSON.stringify(parsedCv.data), user.id));
    if (!cached) {
      await putCachedCvResult("cv_ats", { cv: parsedCv.data }, qualitative);
    }
  } catch (error) {
    const msg =
      error instanceof CvAiError ? error.message : "Could not analyze your CV.";
    return { ok: false, error: msg };
  }

  const atsScore = atsReadinessScore(parsedCv.data);
  const review: StoredAtsReview = {
    atsScore,
    level: atsLevelFromScore(atsScore),
    ...qualitative,
  };

  const checkedAt = new Date();
  const cvHash = cvFingerprint(parsedCv.data);
  try {
    await db
      .update(profiles)
      .set({
        atsScore,
        atsReview: review,
        atsCvHash: cvHash,
        atsCheckedAt: checkedAt,
      })
      .where(eq(profiles.userId, user.id));
  } catch (error) {
    // Don't fail the request — the user still gets their result this session.
    console.error("[analyzeCvAtsAction] persist failed (non-fatal):", error);
  }

  return {
    ok: true,
    data: { review, checkedAt: checkedAt.toISOString(), cvHash },
  };
}

/** (c) ONE Groq call: an ATS-friendlier rewrite of the CV for this JD. */
export async function optimizeCvAction(
  jobDescription: string,
  cv: CvData,
): Promise<Result<{ optimized: CvData }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const jd = jdSchema.safeParse(jobDescription);
  const parsedCv = cvSchema.safeParse(cv);
  if (!jd.success || !parsedCv.success) {
    return { ok: false, error: "Please provide a job description first." };
  }

  if (!allowAction(`cv-optimize:${user.id}`, 5, 60_000)) {
    return {
      ok: false,
      error: "You're going a bit fast — try again in a minute.",
    };
  }

  const { missing } = analyzeMatch(parsedCv.data, jd.data);
  const cacheInput = { cv: parsedCv.data, jd: jd.data };

  try {
    const cached = await getCachedCvResult<CvData>("cv_optimize", cacheInput);
    if (cached) return { ok: true, data: { optimized: cached } };

    const aiOut = await optimizeCvForJob(
      { jobDescription: jd.data, cv: parsedCv.data, missing },
      user.id,
    );
    // Don't trust the AI's array order/count/membership — graft only its text
    // improvements onto the original ordered CV, then clamp/dedup. The result
    // is a subset of the already-valid original, so re-validation effectively
    // can't fail; if it somehow does, degrade gracefully (return the merge)
    // rather than erroring the whole request.
    const merged = normalizeCv(mergeOptimizedCv(parsedCv.data, aiOut, missing));
    const safe = cvSchema.safeParse(merged);
    if (!safe.success) {
      console.error(
        "[optimizeCvAction] post-normalize parse failed (non-fatal):",
        safe.error.issues[0],
      );
    }
    const optimized = safe.success ? safe.data : merged;
    await putCachedCvResult("cv_optimize", cacheInput, optimized);
    return { ok: true, data: { optimized } };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not optimize your CV.";
    return { ok: false, error: msg };
  }
}

/* -------------------------------------------------------------------------- */
/* Cover letters                                                               */
/* -------------------------------------------------------------------------- */

const coverLetterInputSchema = z.object({
  letterType: z.enum(["generic", "job_specific", "company_specific"]),
  jobTitle: z.string().trim().max(160).optional().default(""),
  companyName: z.string().trim().max(160).optional().default(""),
  jobDescription: z.string().trim().max(8000).optional().default(""),
});

export interface CoverLetterRecord {
  id: string;
  letterType: CoverLetterType;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  content: string;
  createdAt: string;
}

/**
 * Build the cover-letter closing + signature from the CV's real contact data.
 * Links are labelled by type and ordered LinkedIn → GitHub → other so the block
 * reads the way candidates expect; the phone keeps a leading marker so it reads
 * like a hand-signed letter. Email is always included — a recruiter needs a way
 * to reply.
 */
function coverLetterSignature(contact: CvData["contact"]): string {
  const lines = [
    "Thank you for your time and consideration.",
    "",
    "Best regards,",
  ];
  if (contact.name) lines.push(contact.name);
  if (contact.phone) lines.push(`📞 ${contact.phone}`);
  if (contact.email) lines.push(`Email: ${contact.email}`);

  // Group links by type, then list the most relevant first.
  const linkedIn: string[] = [];
  const gitHub: string[] = [];
  const other: string[] = [];
  for (const raw of contact.links) {
    const url = raw.trim();
    if (!url) continue;
    if (/linkedin\.com/i.test(url)) linkedIn.push(`LinkedIn: ${url}`);
    else if (/github\.com/i.test(url)) gitHub.push(`GitHub: ${url}`);
    else other.push(`Portfolio: ${url}`);
  }
  lines.push(...linkedIn, ...gitHub, ...other);
  return lines.join("\n");
}

/** Generate a cover letter (does not persist — the user saves explicitly). */
export async function generateCoverLetterAction(
  input: unknown,
): Promise<Result<{ content: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const p = coverLetterInputSchema.safeParse(input);
  if (!p.success) {
    return { ok: false, error: p.error.issues[0]?.message ?? "Invalid input." };
  }
  if (
    (p.data.letterType === "company_specific" && !p.data.companyName) ||
    (p.data.letterType === "job_specific" && !p.data.jobDescription)
  ) {
    return {
      ok: false,
      error:
        p.data.letterType === "company_specific"
          ? "Add a company name for a company-specific letter."
          : "Paste a job description for a job-specific letter.",
    };
  }
  if (!allowAction(`cover-letter:${user.id}`, 6, 60_000)) {
    return {
      ok: false,
      error: "You're going a bit fast — try again in a minute.",
    };
  }

  const [row] = await db
    .select({ cvText: profiles.cvText, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, user.id));
  const cvText = cvPlainText(row?.cvText);
  // Structured contact drives the appended signature block (real values, no
  // AI guessing). Fall back to the profile display name when the CV omits one.
  const contact = parseStoredCv(row?.cvText).contact;
  if (!contact.name && row?.displayName) contact.name = row.displayName;

  try {
    const body = await generateCoverLetter(
      {
        letterType: p.data.letterType,
        cvText,
        jobTitle: p.data.jobTitle,
        companyName: p.data.companyName,
        jobDescription: p.data.jobDescription,
      },
      user.id,
    );
    const content = `${body.trim()}\n\n${coverLetterSignature(contact)}`;
    return { ok: true, data: { content } };
  } catch (error) {
    const msg =
      error instanceof CvAiError
        ? error.message
        : "Could not generate the cover letter.";
    return { ok: false, error: msg };
  }
}

/** Persist a (possibly edited) cover letter. */
export async function saveCoverLetter(
  input: unknown,
): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const schema = coverLetterInputSchema.extend({
    content: z.string().trim().min(1).max(20000),
  });
  const p = schema.safeParse(input);
  if (!p.success) {
    return { ok: false, error: p.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const [created] = await db
      .insert(coverLetters)
      .values({
        userId: user.id,
        letterType: p.data.letterType,
        jobTitle: p.data.jobTitle,
        companyName: p.data.companyName,
        jobDescription: p.data.jobDescription,
        content: p.data.content,
      })
      .returning({ id: coverLetters.id });
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    console.error("[saveCoverLetter]", error);
    return { ok: false, error: "Could not save the cover letter." };
  }
}

/** List the user's saved cover letters, newest first. */
export async function listCoverLetters(): Promise<CoverLetterRecord[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = await db
    .select()
    .from(coverLetters)
    .where(eq(coverLetters.userId, user.id))
    .orderBy(desc(coverLetters.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    letterType: r.letterType,
    jobTitle: r.jobTitle,
    companyName: r.companyName,
    jobDescription: r.jobDescription,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Delete a saved cover letter the user owns. */
export async function deleteCoverLetter(id: string): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const idp = z.string().uuid().safeParse(id);
  if (!idp.success) return { ok: false, error: "Invalid letter." };
  try {
    await db
      .delete(coverLetters)
      .where(
        and(eq(coverLetters.id, idp.data), eq(coverLetters.userId, user.id)),
      );
    return { ok: true, data: true };
  } catch (error) {
    console.error("[deleteCoverLetter]", error);
    return { ok: false, error: "Could not delete the cover letter." };
  }
}
