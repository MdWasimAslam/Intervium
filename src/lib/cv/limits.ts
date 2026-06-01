/**
 * Single source of truth for CV field bounds — pure data, no deps.
 *
 * Both the Zod validator (`cvSchema` in `src/lib/actions/cv.ts`) and the
 * defensive normalizer (`normalizeCv` in `./normalize`) read these, so the
 * "what's the max number of bullets?" answer can never drift between the
 * validate path and the clamp path. Keep this file free of "use server" /
 * server-only imports so it's usable on the client too.
 */

/** Max length (in characters) for each free-text field. */
export const STR_MAX = {
  name: 120,
  title: 160,
  email: 160,
  phone: 60,
  location: 120,
  link: 300,
  summary: 4000,
  expTitle: 200,
  expCompany: 160,
  expPeriod: 80,
  expDescription: 2000,
  bullet: 600,
  projectName: 200,
  projectUrl: 300,
  projectDescription: 2000,
  skill: 60,
  eduDegree: 160,
  eduInstitution: 200,
  eduPeriod: 80,
  eduDetails: 600,
  certName: 200,
  certIssuer: 160,
  certUrl: 300,
  language: 80,
} as const;

/** Max number of items for each array field. */
export const ARR_MAX = {
  links: 12,
  experience: 30,
  bullets: 20,
  projects: 30,
  skills: 120,
  education: 15,
  certifications: 20,
  languages: 20,
} as const;
