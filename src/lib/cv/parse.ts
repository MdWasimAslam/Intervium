/**
 * CV parsing & serialization — pure, in-app, zero AI.
 *
 * `profiles.cv_text` may hold (1) an Intervium JSON envelope we wrote, (2) a
 * bare JSON CV, or (3) free-form pasted text. `parseStoredCv` normalises all
 * three into a `CvData`. `serializeCv` writes the envelope back, and
 * `cvPlainText` extracts clean text for the question-engine excerpt.
 */
import {
  type CvCertification,
  type CvData,
  type CvEducation,
  type CvEnvelope,
  type CvExperience,
  type CvProject,
  emptyCv,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Parse whatever is stored in `cv_text` into structured `CvData`. */
export function parseStoredCv(cvText: string | null | undefined): CvData {
  const text = (cvText ?? "").trim();
  if (!text) return emptyCv();

  const json = tryParseJson(text);
  if (json && typeof json === "object") {
    // Our own envelope.
    if ((json as CvEnvelope)._iv === 1 && (json as CvEnvelope).data) {
      return coerceCvData((json as CvEnvelope).data);
    }
    // A bare JSON CV the user pasted.
    return coerceCvData(json);
  }

  return parsePlainText(text);
}

/**
 * Whether a string is an acceptable CV input. We accept JSON-format CVs only:
 * a non-empty value must parse as a JSON object or array. Empty/whitespace is
 * allowed because a CV is optional; plain text is rejected. Use this to gate
 * input on the client and to validate server actions.
 */
export function isCvJson(cvText: string | null | undefined): boolean {
  const text = (cvText ?? "").trim();
  if (!text) return true;
  const json = tryParseJson(text);
  return json !== null && typeof json === "object";
}

/** Serialize to the JSON envelope stored in `cv_text` (preserves `raw`). */
export function serializeCv(data: CvData, raw?: string): string {
  const envelope: CvEnvelope = {
    _iv: 1,
    raw: raw ?? cvToPlainText(data),
    data,
  };
  return JSON.stringify(envelope);
}

/**
 * Clean plain-text view of a stored CV, for the question-engine excerpt.
 * Falls back to the raw stored text when it isn't JSON.
 */
export function cvPlainText(cvText: string | null | undefined): string {
  const text = (cvText ?? "").trim();
  if (!text) return "";

  const json = tryParseJson(text);
  if (json && typeof json === "object") {
    if ((json as CvEnvelope)._iv === 1) {
      const env = json as CvEnvelope;
      return (
        (env.raw && env.raw.trim()) || cvToPlainText(coerceCvData(env.data))
      );
    }
    return cvToPlainText(coerceCvData(json));
  }
  return text;
}

/** Flatten structured `CvData` into readable plain text (for matching / AI). */
export function cvToPlainText(data: CvData): string {
  const parts: string[] = [];
  const { contact, summary, experience, projects, skills, education } = data;
  const { certifications, languages } = data;

  const contactLine = [
    contact.name,
    contact.title,
    contact.email,
    contact.phone,
    contact.location,
  ]
    .filter(Boolean)
    .join(" · ");
  if (contactLine) parts.push(contactLine);
  if (contact.links.length) parts.push(contact.links.join(" "));
  if (summary) parts.push(summary);

  for (const exp of experience) {
    const head = [exp.title, exp.company, exp.period]
      .filter(Boolean)
      .join(" — ");
    if (head) parts.push(head);
    if (exp.description) parts.push(exp.description);
    for (const b of exp.bullets) parts.push(b);
  }

  for (const proj of projects) {
    parts.push([proj.name, proj.description].filter(Boolean).join(" — "));
  }

  if (skills.length) parts.push(skills.join(", "));

  for (const edu of education) {
    parts.push(
      [edu.degree, edu.institution, edu.period, edu.details]
        .filter(Boolean)
        .join(" — "),
    );
  }

  for (const cert of certifications) {
    parts.push([cert.name, cert.issuer].filter(Boolean).join(" — "));
  }

  if (languages.length) parts.push(languages.join(", "));

  return parts.filter(Boolean).join("\n");
}

/** Stable, cheap FNV-1a hash of any string. Pure — safe on client and server. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Stable, cheap fingerprint of a CV's textual content (FNV-1a). Used to detect
 * whether the CV changed since its last AI ATS review, so the UI can flag a
 * stored score as stale. Pure & deterministic — safe on client and server.
 */
export function cvFingerprint(data: CvData): string {
  return fnv1a(cvToPlainText(data));
}

/**
 * Deterministic `JSON.stringify` with object keys sorted recursively, so an
 * identical logical value always serializes to the same string regardless of
 * key insertion order. Used to build stable, content-addressed AI cache keys.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) out[key] = sortKeysDeep(src[key]);
    return out;
  }
  return value;
}

/**
 * De-duplicate strings case-insensitively while preserving first-seen order and
 * the first-seen original casing. Blank/whitespace-only entries are dropped.
 * Shared by skills/languages/links handling so the same value never appears
 * twice (e.g. "React" + "react" from a categorized skills object).
 */
export function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* JSON coercion                                                              */
/* -------------------------------------------------------------------------- */

function tryParseJson(text: string): unknown {
  if (!(text.startsWith("{") || text.startsWith("["))) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const str = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];

/**
 * Flatten skills given as either a flat array or a categorized object, then
 * de-duplicate case-insensitively. A categorized object (e.g.
 * `{ frontend: ["React"], fullstack: ["React", "Node"] }`) routinely repeats a
 * skill across groups, so the dedup is essential — not cosmetic.
 */
function coerceSkills(v: unknown): string[] {
  if (Array.isArray(v)) return dedupePreserveOrder(strArray(v));
  if (v && typeof v === "object") {
    return dedupePreserveOrder(
      Object.values(v as Record<string, unknown>).flatMap((group) =>
        Array.isArray(group) ? strArray(group) : str(group) ? [str(group)] : [],
      ),
    );
  }
  return [];
}

/** Gather profile URLs from a `links` array plus common single-URL keys. */
const LINK_KEYS = [
  "github",
  "linkedin",
  "twitter",
  "x",
  "website",
  "portfolio",
  "url",
  "gitlab",
  "dribbble",
  "behance",
  "blog",
];
function coerceLinks(
  contact: Record<string, unknown>,
  o: Record<string, unknown>,
): string[] {
  const links = new Set<string>(strArray(contact.links ?? o.links));
  for (const src of [contact, o]) {
    for (const k of LINK_KEYS) {
      const val = str(src[k]);
      if (val) links.add(val);
    }
  }
  return [...links];
}

/** Lenient mapping of an arbitrary parsed object into `CvData`. */
function coerceCvData(input: unknown): CvData {
  const o = (input ?? {}) as Record<string, unknown>;
  const base = emptyCv();

  const contact = (o.contact ?? {}) as Record<string, unknown>;
  base.contact = {
    name: str(contact.name) || str(o.name),
    title:
      str(o.title) ||
      str(contact.title) ||
      str(o.headline) ||
      str(contact.headline),
    email: str(contact.email) || str(o.email),
    phone: str(contact.phone) || str(o.phone),
    location: str(contact.location) || str(o.location),
    links: coerceLinks(contact, o),
  };

  base.summary =
    str(o.summary) || str(o.profile) || str(o.objective) || str(o.about);

  // Accept both `experience` and `workExperience`.
  const exp = Array.isArray(o.experience)
    ? o.experience
    : Array.isArray(o.workExperience)
      ? o.workExperience
      : [];
  base.experience = exp.map((e): CvExperience => {
    const r = (e ?? {}) as Record<string, unknown>;
    const position = str(r.title) || str(r.role) || str(r.position);
    const project = str(r.project);
    return {
      // Fold "Position — Project" so the project name isn't lost.
      title: [position, project].filter(Boolean).join(" — "),
      company: str(r.company) || str(r.employer) || str(r.organization),
      period: str(r.period) || str(r.dates) || str(r.duration),
      link: str(r.website) || str(r.url) || str(r.link),
      description: str(r.description) || str(r.summary),
      bullets: strArray(r.bullets ?? r.highlights ?? r.responsibilities),
    };
  });

  const projects = Array.isArray(o.projects) ? o.projects : [];
  base.projects = projects.map((p): CvProject => {
    const r = (p ?? {}) as Record<string, unknown>;
    return {
      name: str(r.name) || str(r.title),
      url: str(r.url) || str(r.link) || str(r.website),
      description: str(r.description) || str(r.summary),
    };
  });

  base.skills = coerceSkills(o.skills ?? o.technologies);

  const edu = Array.isArray(o.education) ? o.education : [];
  base.education = edu.map((e): CvEducation => {
    const r = (e ?? {}) as Record<string, unknown>;
    const extras = [
      str(r.board),
      str(r.cgpa) && `CGPA: ${str(r.cgpa)}`,
      str(r.gpa) && `GPA: ${str(r.gpa)}`,
      str(r.percentage),
      str(r.grade) && `Grade: ${str(r.grade)}`,
      str(r.details) || str(r.description),
    ].filter(Boolean);
    return {
      degree: str(r.degree) || str(r.qualification),
      institution: str(r.institution) || str(r.school) || str(r.university),
      period: str(r.period) || str(r.dates) || str(r.duration) || str(r.year),
      details: extras.join(" · "),
    };
  });

  const certs = Array.isArray(o.certifications) ? o.certifications : [];
  base.certifications = certs.map((c): CvCertification => {
    const r = (c ?? {}) as Record<string, unknown>;
    return {
      name: str(r.name) || str(r.title),
      issuer: str(r.issuer) || str(r.authority) || str(r.organization),
      url: str(r.url) || str(r.link),
    };
  });

  base.languages = dedupePreserveOrder(strArray(o.languages));

  return base;
}

/* -------------------------------------------------------------------------- */
/* Heuristic plain-text parser                                                */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL_RE =
  /\b((?:https?:\/\/|www\.)\S+|(?:linkedin\.com|github\.com)\/\S+)/gi;
const BULLET_RE = /^\s*[•·▪◦*\-–—]\s+/;

type SectionKind =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "contact";

const HEADING_PATTERNS: { kind: SectionKind; re: RegExp }[] = [
  {
    kind: "summary",
    re: /^(summary|profile|objective|about( me)?|professional summary)\b/i,
  },
  {
    kind: "experience",
    re: /^(experience|work experience|professional experience|employment|work history|career)\b/i,
  },
  {
    kind: "skills",
    re: /^(skills|technical skills|technologies|tech stack|core competencies)\b/i,
  },
  {
    kind: "education",
    re: /^(education|academic background|qualifications)\b/i,
  },
  {
    kind: "contact",
    re: /^(contact|contact (info|details)|personal details)\b/i,
  },
];

/** Is this line a section heading? Short lines that match a known keyword. */
function matchHeading(line: string): SectionKind | null {
  const trimmed = line
    .trim()
    .replace(/[:#]+$/, "")
    .trim();
  if (!trimmed || trimmed.length > 40) return null;
  if (BULLET_RE.test(line)) return null;
  for (const { kind, re } of HEADING_PATTERNS) {
    if (re.test(trimmed)) return kind;
  }
  return null;
}

function parsePlainText(text: string): CvData {
  const cv = emptyCv();
  const rawLines = text.split(/\r?\n/);

  // Partition into a pre-heading header block + named sections.
  const header: string[] = [];
  const sections = new Map<SectionKind, string[]>();
  let current: SectionKind | null = null;

  for (const line of rawLines) {
    const kind = matchHeading(line);
    if (kind) {
      current = kind;
      if (!sections.has(kind)) sections.set(kind, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
    else header.push(line);
  }

  // Contact: scan header first, then the whole document as a fallback.
  const contactSource = [...header, ...(sections.get("contact") ?? [])].join(
    "\n",
  );
  fillContact(cv, contactSource, text);

  // Header leftovers (no section) become the summary if none was given.
  const headerProse = header
    .filter((l) => l.trim())
    .filter((l) => !EMAIL_RE.test(l) && !PHONE_RE.test(l) && !isLinkLine(l))
    .filter((l) => l.trim() !== cv.contact.name)
    .join(" ")
    .trim();

  const summarySection = joinProse(sections.get("summary"));
  cv.summary = summarySection || headerProse;

  cv.skills = parseSkills(sections.get("skills"));
  cv.experience = parseExperience(sections.get("experience"));
  cv.education = parseEducation(sections.get("education"));

  return cv;
}

function isLinkLine(line: string): boolean {
  URL_RE.lastIndex = 0;
  return URL_RE.test(line);
}

function fillContact(cv: CvData, source: string, fullText: string) {
  const email =
    source.match(EMAIL_RE)?.[0] ?? fullText.match(EMAIL_RE)?.[0] ?? "";
  const phone = source.match(PHONE_RE)?.[0]?.trim() ?? "";

  const links = new Set<string>();
  for (const re of [source, fullText]) {
    URL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_RE.exec(re))) links.add(m[0].replace(/[.,)]+$/, ""));
  }

  // Name: first meaningful header line that isn't contact noise.
  const firstLines = fullText.split(/\r?\n/).map((l) => l.trim());
  const name =
    firstLines.find(
      (l) =>
        l &&
        l.length <= 60 &&
        !EMAIL_RE.test(l) &&
        !PHONE_RE.test(l) &&
        !isLinkLine(l) &&
        !matchHeading(l) &&
        !BULLET_RE.test(l),
    ) ?? "";

  cv.contact = {
    name,
    title: "",
    email,
    phone,
    location: "",
    links: [...links],
  };
}

function joinProse(lines: string[] | undefined): string {
  return (lines ?? [])
    .map((l) => l.replace(BULLET_RE, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parseSkills(lines: string[] | undefined): string[] {
  if (!lines) return [];
  return lines
    .join(", ")
    .split(/[,;\n•·▪◦|]|\s+[-–—]\s+/)
    .map((s) => s.replace(BULLET_RE, "").trim())
    .filter((s) => s.length > 0 && s.length <= 40);
}

function parseExperience(lines: string[] | undefined): CvExperience[] {
  if (!lines) return [];
  const entries: CvExperience[] = [];
  let current: CvExperience | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (BULLET_RE.test(line)) {
      // A bullet belongs to the current entry (create one if needed).
      if (!current) {
        current = {
          title: "",
          company: "",
          period: "",
          link: "",
          description: "",
          bullets: [],
        };
        entries.push(current);
      }
      current.bullets.push(trimmed.replace(BULLET_RE, "").trim());
      continue;
    }

    // A non-bullet header line starts a new entry. Split "Title — Company — Period".
    const parts = trimmed
      .split(/\s+[—|·]\s+|\s+-\s+|,\s*/)
      .map((p) => p.trim());
    current = {
      title: parts[0] ?? trimmed,
      company: parts[1] ?? "",
      period: parts.slice(2).join(" ") ?? "",
      link: "",
      description: "",
      bullets: [],
    };
    entries.push(current);
  }

  return entries;
}

function parseEducation(lines: string[] | undefined): CvEducation[] {
  if (!lines) return [];
  return lines
    .map((l) => l.replace(BULLET_RE, "").trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+[—|·]\s+|\s+-\s+|,\s*/).map((p) => p.trim());
      return {
        degree: parts[0] ?? line,
        institution: parts[1] ?? "",
        period: parts[2] ?? "",
        details: parts.slice(3).join(", "),
      };
    });
}
