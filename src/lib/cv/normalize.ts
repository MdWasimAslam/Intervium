/**
 * Defensive normalizer — clamps a `CvData` to the bounds in `./limits` and
 * de-duplicates the string-array fields. Pure, no deps beyond limits/parse.
 *
 * Run this on AI output (optimize / import) BEFORE `cvSchema.safeParse`. Zod's
 * `.max()` REJECTS over-long values rather than truncating, so without this a
 * single 21st bullet (or a 5000-char summary) from the model would fail the
 * whole request. Clamping first turns "optimize randomly errors" into "optimize
 * degrades gracefully": the result is always within bounds and always valid.
 */
import { ARR_MAX, STR_MAX } from "./limits";
import { dedupePreserveOrder } from "./parse";
import { emptyCv, type CvData } from "./types";

const s = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").slice(0, max);

const arr = <T>(v: unknown, max: number): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max) as T[];

export function normalizeCv(input: CvData): CvData {
  const cv = { ...emptyCv(), ...(input ?? {}) } as CvData;
  const contact = cv.contact ?? emptyCv().contact;

  return {
    contact: {
      name: s(contact.name, STR_MAX.name),
      title: s(contact.title, STR_MAX.title),
      email: s(contact.email, STR_MAX.email),
      phone: s(contact.phone, STR_MAX.phone),
      location: s(contact.location, STR_MAX.location),
      links: dedupePreserveOrder(arr<string>(contact.links, ARR_MAX.links)).map(
        (l) => s(l, STR_MAX.link),
      ),
    },
    summary: s(cv.summary, STR_MAX.summary),
    experience: arr<CvData["experience"][number]>(
      cv.experience,
      ARR_MAX.experience,
    ).map((e) => ({
      title: s(e?.title, STR_MAX.expTitle),
      company: s(e?.company, STR_MAX.expCompany),
      period: s(e?.period, STR_MAX.expPeriod),
      link: s(e?.link, STR_MAX.link),
      description: s(e?.description, STR_MAX.expDescription),
      bullets: arr<string>(e?.bullets, ARR_MAX.bullets)
        .map((b) => s(b, STR_MAX.bullet))
        .filter(Boolean),
    })),
    projects: arr<CvData["projects"][number]>(cv.projects, ARR_MAX.projects).map(
      (p) => ({
        name: s(p?.name, STR_MAX.projectName),
        url: s(p?.url, STR_MAX.projectUrl),
        description: s(p?.description, STR_MAX.projectDescription),
      }),
    ),
    skills: dedupePreserveOrder(arr<string>(cv.skills, ARR_MAX.skills)).map((sk) =>
      s(sk, STR_MAX.skill),
    ),
    education: arr<CvData["education"][number]>(
      cv.education,
      ARR_MAX.education,
    ).map((e) => ({
      degree: s(e?.degree, STR_MAX.eduDegree),
      institution: s(e?.institution, STR_MAX.eduInstitution),
      period: s(e?.period, STR_MAX.eduPeriod),
      details: s(e?.details, STR_MAX.eduDetails),
    })),
    certifications: arr<CvData["certifications"][number]>(
      cv.certifications,
      ARR_MAX.certifications,
    ).map((c) => ({
      name: s(c?.name, STR_MAX.certName),
      issuer: s(c?.issuer, STR_MAX.certIssuer),
      url: s(c?.url, STR_MAX.certUrl),
    })),
    languages: dedupePreserveOrder(
      arr<string>(cv.languages, ARR_MAX.languages),
    ).map((l) => s(l, STR_MAX.language)),
  };
}
