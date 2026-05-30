/**
 * In-app ATS keyword matching — pure, deterministic, ZERO AI.
 *
 * We extract the meaningful keywords from a job description, check which appear
 * in the CV, and report a percentage plus matched/missing lists. This is the
 * "free" half of the ATS feature; Gemini is only used for qualitative advice.
 */
import { type CvData } from "./types";
import { cvToPlainText } from "./parse";

export interface AtsResult {
  /** 0–100 keyword-overlap percentage. */
  score: number;
  matched: string[];
  missing: string[];
  /** All keywords considered (matched ∪ missing), highest-frequency first. */
  jdKeywords: string[];
}

/** Words too common to be useful as ATS signals. */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
  "has", "this", "that", "they", "them", "their", "from", "was", "were", "been",
  "being", "but", "not", "all", "any", "can", "may", "who", "what", "when",
  "where", "which", "while", "about", "into", "over", "under", "than", "then",
  "out", "off", "per", "via", "etc", "such", "able", "must", "should", "would",
  "could", "also", "more", "most", "some", "other", "within", "across", "using",
  "use", "used", "work", "working", "team", "teams", "role", "job", "company",
  "candidate", "candidates", "experience", "experiences", "year", "years",
  "skill", "skills", "ability", "strong", "good", "great", "excellent", "plus",
  "including", "include", "includes", "well", "high", "new", "help", "ensure",
  "join", "looking", "seeking", "required", "requirements", "responsibilities",
  "responsible", "preferred", "qualifications", "develop", "development",
  "build", "building", "create", "creating", "design", "designing", "support",
  "deliver", "drive", "across", "within", "etc",
  "skilled", "proficient", "proficiency", "knowledge", "familiarity",
  "familiar", "expertise", "understanding", "passionate", "motivated",
]);

/**
 * Multiword tech phrases worth matching as a unit (single tokens would lose the
 * meaning). Lowercased; matched as substrings of the lowercased text.
 */
const PHRASES = [
  "machine learning", "deep learning", "data science", "data analysis",
  "ci/cd", "continuous integration", "continuous deployment", "react native",
  "node.js", "next.js", "vue.js", "rest api", "restful api", "graphql",
  "unit testing", "test driven", "object oriented", "design patterns",
  "microservices", "distributed systems", "cloud computing", "version control",
  "agile", "scrum", "kanban", "project management", "product management",
  "natural language processing", "computer vision", "ruby on rails",
  "spring boot", "asp.net", "entity framework", "amazon web services",
  "google cloud", "infrastructure as code", "message queue", "event driven",
  "single page application", "server side rendering", "user experience",
  "user interface", "responsive design", "cross functional",
];

/** Short tokens that are meaningful despite being under the length floor. */
const SHORT_ALLOW = new Set([
  "go", "ai", "ml", "ci", "cd", "qa", "ux", "ui", "js", "ts", "db", "os",
  "aws", "gcp", "sql", "css", "api", "git", "php", "c++", "c#", "io",
]);

const TOKEN_RE = /[a-z][a-z0-9+#.]*[a-z0-9+#]|[a-z]/g;

/**
 * Extract ranked, de-duplicated keywords from free text. Multiword phrases are
 * detected first, then single tokens, ordered by frequency (desc).
 */
export function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const freq = new Map<string, number>();

  for (const phrase of PHRASES) {
    let from = 0;
    let count = 0;
    let idx: number;
    while ((idx = lower.indexOf(phrase, from)) !== -1) {
      count++;
      from = idx + phrase.length;
    }
    if (count) freq.set(phrase, (freq.get(phrase) ?? 0) + count * 2); // weight phrases
  }

  const tokens = lower.match(TOKEN_RE) ?? [];
  for (const tok of tokens) {
    const t = tok.replace(/\.$/, "");
    if (STOPWORDS.has(t)) continue;
    const ok = t.length >= 3 || SHORT_ALLOW.has(t);
    if (!ok) continue;
    if (/^\d+$/.test(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word);
}

/** Does `keyword` appear in the (already lowercased) CV text? */
function present(keyword: string, cvLower: string): boolean {
  if (keyword.includes(" ") || /[.+#/]/.test(keyword)) {
    return cvLower.includes(keyword);
  }
  // Word-boundary match so "java" doesn't match "javascript".
  const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return re.test(cvLower);
}

/** Cap the keyword set so the UI stays focused and the score stays meaningful. */
const MAX_KEYWORDS = 40;

/** Compare a CV against a job description. Pure & deterministic. */
export function analyzeMatch(cv: CvData, jd: string): AtsResult {
  const jdKeywords = extractKeywords(jd).slice(0, MAX_KEYWORDS);
  const cvLower = cvToPlainText(cv).toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of jdKeywords) {
    (present(kw, cvLower) ? matched : missing).push(kw);
  }

  const score =
    jdKeywords.length === 0
      ? 0
      : Math.round((100 * matched.length) / jdKeywords.length);

  return { score, matched, missing, jdKeywords };
}
