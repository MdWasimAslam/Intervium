/**
 * CV completeness check — pure, no AI.
 *
 * Flags fields that recruiters and Applicant Tracking Systems universally
 * expect, so the "CV maker" can nudge the user to fill the gaps. We split
 * issues into `required` (a CV is incomplete without them) and `recommended`
 * (strongly improves acceptance, but not strictly mandatory).
 */
import { type CvData } from "./types";

export type IssueSeverity = "required" | "recommended";

export interface CvIssue {
  field: string;
  message: string;
  severity: IssueSeverity;
}

export interface CvCompleteness {
  issues: CvIssue[];
  /** 0–100 — share of all checks that pass. */
  score: number;
  isComplete: boolean;
}

export function assessCv(cv: CvData): CvCompleteness {
  const issues: CvIssue[] = [];
  const req = (field: string, ok: boolean, message: string) => {
    if (!ok) issues.push({ field, message, severity: "required" });
    return ok;
  };
  const rec = (field: string, ok: boolean, message: string) => {
    if (!ok) issues.push({ field, message, severity: "recommended" });
    return ok;
  };

  const checks: boolean[] = [];

  checks.push(req("name", cv.contact.name.trim().length > 0, "Add your full name."));
  checks.push(
    req(
      "email",
      /\S+@\S+\.\S+/.test(cv.contact.email),
      "Add a valid email address — recruiters need a way to reach you.",
    ),
  );
  checks.push(req("phone", cv.contact.phone.trim().length > 0, "Add a phone number."));
  checks.push(
    req(
      "experience",
      cv.experience.some((e) => e.title || e.company),
      "Add at least one work experience entry.",
    ),
  );
  checks.push(
    req(
      "skills",
      cv.skills.length >= 3,
      "List at least a few skills — ATS scans these first.",
    ),
  );
  checks.push(
    req("education", cv.education.length > 0, "Add your education."),
  );

  checks.push(
    rec(
      "title",
      cv.contact.title.trim().length > 0,
      "Add a professional title (e.g. “Software Developer”) under your name.",
    ),
  );
  checks.push(
    rec(
      "location",
      cv.contact.location.trim().length > 0,
      "Add your location (city, country) — most roles filter by it.",
    ),
  );
  checks.push(
    rec(
      "links",
      cv.contact.links.length > 0,
      "Add a LinkedIn or portfolio link.",
    ),
  );
  checks.push(
    rec(
      "summary",
      cv.summary.trim().length >= 40,
      "Add a 2–3 sentence professional summary.",
    ),
  );
  checks.push(
    rec(
      "experience-detail",
      cv.experience.every((e) => e.description || e.bullets.some(Boolean)) &&
        cv.experience.length > 0,
      "Describe each role with a short summary or bullet points.",
    ),
  );
  checks.push(
    rec(
      "experience-dates",
      cv.experience.length > 0 && cv.experience.every((e) => e.period.trim().length > 0),
      "Add start–end dates to every role (ATS expects a timeline).",
    ),
  );

  const passed = checks.filter(Boolean).length;
  const score = Math.round((100 * passed) / checks.length);
  const isComplete = !issues.some((i) => i.severity === "required");

  return { issues, score, isComplete };
}
