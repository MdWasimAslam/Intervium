/**
 * Shared CV data model for the /cv feature.
 *
 * A CV is parsed from `profiles.cv_text` (plain text or JSON) into this
 * structured shape, edited in the UI, then persisted back as a JSON envelope
 * (see `parse.ts`). No DB schema change — we only reuse the existing column.
 */

export interface CvContact {
  name: string;
  /** Professional title / headline, e.g. "Software Developer". */
  title: string;
  email: string;
  phone: string;
  location: string;
  /** Profile / portfolio URLs (GitHub, LinkedIn, website, …). */
  links: string[];
}

export interface CvExperience {
  title: string;
  company: string;
  period: string;
  /** Optional project / company URL. */
  link: string;
  /** A short paragraph describing the role (kept alongside bullets). */
  description: string;
  bullets: string[];
}

export interface CvProject {
  name: string;
  url: string;
  description: string;
}

export interface CvEducation {
  degree: string;
  institution: string;
  period: string;
  /** Free-text extras: CGPA, board, percentage, etc. */
  details: string;
}

export interface CvCertification {
  name: string;
  issuer: string;
  url: string;
}

export interface CvData {
  contact: CvContact;
  summary: string;
  experience: CvExperience[];
  projects: CvProject[];
  skills: string[];
  education: CvEducation[];
  certifications: CvCertification[];
  languages: string[];
}

/**
 * What we actually store in `profiles.cv_text`: the structured data plus the
 * original raw text, so nothing the user pasted is ever lost and the
 * question-engine can still read a clean text excerpt.
 */
export interface CvEnvelope {
  _iv: 1;
  raw: string;
  data: CvData;
}

/** An empty, well-formed CV — used as the fallback / new-CV starting point. */
export function emptyCv(): CvData {
  return {
    contact: { name: "", title: "", email: "", phone: "", location: "", links: [] },
    summary: "",
    experience: [],
    projects: [],
    skills: [],
    education: [],
    certifications: [],
    languages: [],
  };
}
