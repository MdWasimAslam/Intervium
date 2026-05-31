"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, profiles } from "@db";
import { getCurrentUser } from "@/lib/session";
import { allowAction } from "@/lib/rate-limit";
import { serializeCv } from "@/lib/cv/parse";
import { analyzeMatch } from "@/lib/cv/ats";
import { type CvData } from "@/lib/cv/types";
import {
  analyzeJobMatch,
  type CvMatchAnalysis,
  CvAiError,
  optimizeCvForJob,
} from "@/lib/groq";

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const cvSchema = z.object({
  contact: z.object({
    name: z.string().max(120),
    title: z.string().max(160),
    email: z.string().max(160),
    phone: z.string().max(60),
    location: z.string().max(120),
    links: z.array(z.string().max(300)).max(12),
  }),
  summary: z.string().max(4000),
  experience: z
    .array(
      z.object({
        title: z.string().max(200),
        company: z.string().max(160),
        period: z.string().max(80),
        link: z.string().max(300),
        description: z.string().max(2000),
        bullets: z.array(z.string().max(600)).max(20),
      }),
    )
    .max(30),
  projects: z
    .array(
      z.object({
        name: z.string().max(200),
        url: z.string().max(300),
        description: z.string().max(2000),
      }),
    )
    .max(30),
  skills: z.array(z.string().max(60)).max(120),
  education: z
    .array(
      z.object({
        degree: z.string().max(160),
        institution: z.string().max(200),
        period: z.string().max(80),
        details: z.string().max(600),
      }),
    )
    .max(15),
  certifications: z
    .array(
      z.object({
        name: z.string().max(200),
        issuer: z.string().max(160),
        url: z.string().max(300),
      }),
    )
    .max(20),
  languages: z.array(z.string().max(80)).max(20),
});

const jdSchema = z.string().trim().min(1).max(8000);

/* -------------------------------------------------------------------------- */
/* Result types                                                               */
/* -------------------------------------------------------------------------- */

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
type Result<T> = Ok<T> | Err;

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

/** Persist the edited CV back to `profiles.cv_text` as a JSON envelope. */
export async function saveCv(data: CvData): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid CV." };
  }

  try {
    await db
      .update(profiles)
      .set({ cvText: serializeCv(parsed.data), updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));
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
    return { ok: false, error: "You're going a bit fast — try again in a minute." };
  }

  // Reuse the in-app match so the AI gets concrete keyword context.
  const { score, matched, missing } = analyzeMatch(parsedCv.data, jd.data);

  try {
    const analysis = await analyzeJobMatch({
      jobDescription: jd.data,
      cvText: JSON.stringify(parsedCv.data),
      matched,
      missing,
      keywordScore: score,
    });
    return { ok: true, data: analysis };
  } catch (error) {
    const msg =
      error instanceof CvAiError ? error.message : "Could not analyze the match.";
    return { ok: false, error: msg };
  }
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
    return { ok: false, error: "You're going a bit fast — try again in a minute." };
  }

  const { missing } = analyzeMatch(parsedCv.data, jd.data);

  try {
    const optimized = await optimizeCvForJob({
      jobDescription: jd.data,
      cv: parsedCv.data,
      missing,
    });
    // Re-validate the model's output before handing it to the client.
    const safe = cvSchema.safeParse(optimized);
    if (!safe.success) {
      return { ok: false, error: "The AI returned an unexpected CV. Please try again." };
    }
    return { ok: true, data: { optimized: safe.data } };
  } catch (error) {
    const msg =
      error instanceof CvAiError ? error.message : "Could not optimize your CV.";
    return { ok: false, error: msg };
  }
}
