/**
 * In-app ATS keyword matching — pure, deterministic, ZERO AI.
 *
 * We extract the meaningful keywords from a job description, check which appear
 * in the CV, and report a percentage plus matched/missing lists. This is the
 * "free" half of the ATS feature; Groq is only used for qualitative advice.
 *
 * Quality comes from a curated SKILLS LEXICON: real technical skills (languages,
 * frameworks, tools, concepts) are recognised, ALWAYS kept (never dropped by the
 * cap), ranked above generic words, and weighted more heavily in the score — so
 * a JD's filler/perks vocabulary ("allowance", "insurance", "world") can't crowd
 * out the terms an ATS actually keys on ("javascript", "react", "aws").
 */
import { type AtsLevel, type CvData } from "./types";
import { cvToPlainText } from "./parse";

export interface AtsResult {
  /** 0–100 keyword-overlap percentage (skill keywords weighted higher). */
  score: number;
  matched: string[];
  missing: string[];
  /** All keywords considered (matched ∪ missing), skills first. */
  jdKeywords: string[];
  /** The subset of jdKeywords recognised as technical skills. */
  skillKeywords: string[];
}

/**
 * Deterministic fit bands. The Fit Level is ALWAYS derived from the displayed
 * score — never self-reported by the model — so the label and the number can
 * never disagree (no more "72% = Moderate").
 */
export type FitLevel = "strong" | "good" | "moderate" | "weak" | "poor";

export interface FitLevelInfo {
  key: FitLevel;
  label: string;
}

export function fitLevelFromScore(score: number): FitLevelInfo {
  if (score >= 85) return { key: "strong", label: "Strong fit" };
  if (score >= 70) return { key: "good", label: "Good fit" };
  if (score >= 55) return { key: "moderate", label: "Moderate fit" };
  if (score >= 40) return { key: "weak", label: "Weak fit" };
  return { key: "poor", label: "Poor fit" };
}

/**
 * ATS-readiness band shown alongside the deterministic readiness score (no JD).
 * Always derived from the number, so label and score can never disagree.
 * Bands mirror the AI's old enum so the existing UI keeps working unchanged.
 */
export function atsLevelFromScore(score: number): AtsLevel {
  if (score >= 80) return "strong";
  if (score >= 55) return "good";
  return "needs-work";
}

/**
 * Deterministic ATS-readiness score for a CV on its own (no job description).
 *
 * Replaces the AI's self-reported `atsScore`, which fluctuated between runs and
 * didn't move sensibly when the CV was edited. This is a pure, weighted sum of
 * structural signals an ATS / recruiter actually keys on, so the number is
 * stable for identical input and responds monotonically to real improvements
 * (adding contact info, quantifying a bullet, etc. never lowers it).
 *
 * Weights total 100. Tuned so a complete, quantified, well-sized CV lands in
 * the 80s+ ("strong") and a sparse one lands low.
 */
export function atsReadinessScore(cv: CvData): number {
  let score = 0;

  // Contact completeness — ATS parsers need a way to reach the candidate (20).
  if (cv.contact.email.trim()) score += 8;
  if (cv.contact.phone.trim()) score += 4;
  if (cv.contact.name.trim()) score += 4;
  if (cv.contact.location.trim()) score += 2;
  if (cv.contact.links.length > 0) score += 2;

  // A professional summary (8).
  if (cv.summary.trim().length >= 40) score += 8;
  else if (cv.summary.trim()) score += 4;

  const realExperience = cv.experience.filter((e) => e.title || e.company);
  const allBullets = realExperience.flatMap((e) => e.bullets.filter(Boolean));

  // Experience present, with bullets (24).
  if (realExperience.length >= 1) score += 8;
  if (realExperience.length >= 2) score += 4;
  if (allBullets.length >= 3) score += 8;
  else if (allBullets.length >= 1) score += 4;
  // Every experience entry has at least one bullet (structure ATS likes) (4).
  if (
    realExperience.length > 0 &&
    realExperience.every((e) => e.bullets.some(Boolean))
  ) {
    score += 4;
  }

  // Quantified impact — bullets with a number/percentage read as achievements (14).
  const quantified = allBullets.filter((b) => /\d/.test(b)).length;
  if (quantified >= 3) score += 14;
  else if (quantified >= 1) score += 8;

  // Healthy skills band — enough to match keywords, not a keyword-stuffed wall (14).
  const skillCount = cv.skills.length;
  if (skillCount >= 6 && skillCount <= 40) score += 14;
  else if (skillCount >= 3) score += 9;
  else if (skillCount >= 1) score += 4;

  // Education present (8).
  if (cv.education.some((e) => e.degree || e.institution)) score += 8;

  // Dates on experience help ATS build a timeline (6).
  if (realExperience.length > 0 && realExperience.every((e) => e.period.trim())) {
    score += 6;
  } else if (realExperience.some((e) => e.period.trim())) {
    score += 3;
  }

  // Penalty: overly long bullets parse poorly and read as walls of text (−6).
  const tooLong = allBullets.filter((b) => b.length > 320).length;
  if (tooLong >= 2) score -= 6;
  else if (tooLong === 1) score -= 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Words too common to be useful as ATS signals. */
const STOPWORDS = new Set([
  // Generic English / JD boilerplate.
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "our",
  "are",
  "will",
  "have",
  "has",
  "this",
  "that",
  "they",
  "them",
  "their",
  "from",
  "was",
  "were",
  "been",
  "being",
  "but",
  "not",
  "all",
  "any",
  "can",
  "may",
  "who",
  "what",
  "when",
  "where",
  "which",
  "while",
  "about",
  "into",
  "over",
  "under",
  "than",
  "then",
  "out",
  "off",
  "per",
  "via",
  "etc",
  "such",
  "able",
  "must",
  "should",
  "would",
  "could",
  "also",
  "more",
  "most",
  "some",
  "other",
  "within",
  "across",
  "using",
  "use",
  "used",
  "work",
  "working",
  "team",
  "teams",
  "role",
  "job",
  "company",
  "candidate",
  "candidates",
  "experience",
  "experiences",
  "year",
  "years",
  "skill",
  "skills",
  "ability",
  "strong",
  "good",
  "great",
  "excellent",
  "plus",
  "including",
  "include",
  "includes",
  "well",
  "high",
  "new",
  "help",
  "ensure",
  "join",
  "looking",
  "seeking",
  "required",
  "requirements",
  "responsibilities",
  "responsible",
  "preferred",
  "qualifications",
  "develop",
  "development",
  "build",
  "building",
  "create",
  "creating",
  "design",
  "designing",
  "support",
  "deliver",
  "drive",
  "skilled",
  "proficient",
  "proficiency",
  "knowledge",
  "familiarity",
  "familiar",
  "expertise",
  "understanding",
  "passionate",
  "motivated",
  // Perks / compensation / HR vocabulary — never a skill match.
  "salary",
  "competitive",
  "generous",
  "stock",
  "options",
  "equity",
  "bonus",
  "benefit",
  "benefits",
  "perk",
  "perks",
  "insurance",
  "health",
  "wellness",
  "gym",
  "meal",
  "membership",
  "memberships",
  "meditation",
  "retreat",
  "retreats",
  "allowance",
  "vacation",
  "holiday",
  "holidays",
  "workspace",
  "flexible",
  "hours",
  "fulltime",
  "remote",
  "hybrid",
  "onsite",
  "relocation",
  "comprehensive",
  "coverage",
  "annual",
  // Company / marketing fluff common in JDs.
  "world",
  "global",
  "largest",
  "backbone",
  "sustainable",
  "economy",
  "economic",
  "progress",
  "iconic",
  "pride",
  "asset",
  "precious",
  "frictionless",
  "smooth",
  "enjoyable",
  "smarter",
  "mission",
  "vision",
  "culture",
  "values",
  "ethics",
  "impact",
  "ground",
  "people",
  "absolutely",
]);

/**
 * Single-token technical skills. Recognised regardless of frequency, never
 * dropped by the keyword cap, and weighted higher in the score.
 */
const SKILL_TOKENS = new Set([
  // Languages.
  "javascript",
  "typescript",
  "python",
  "java",
  "golang",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "rust",
  "perl",
  "html",
  "css",
  "sass",
  "scss",
  "less",
  "sql",
  "nosql",
  "bash",
  "powershell",
  "matlab",
  "dart",
  "elixir",
  "clojure",
  "haskell",
  "lua",
  "groovy",
  // Frontend libraries / tooling.
  "react",
  "angular",
  "vue",
  "svelte",
  "redux",
  "mobx",
  "jquery",
  "ember",
  "tailwind",
  "bootstrap",
  "webpack",
  "vite",
  "rollup",
  "babel",
  "eslint",
  "storybook",
  "jest",
  "cypress",
  "playwright",
  "vitest",
  // Backend frameworks / runtimes.
  "node",
  "nodejs",
  "express",
  "nestjs",
  "koa",
  "django",
  "flask",
  "fastapi",
  "spring",
  "rails",
  "laravel",
  "symfony",
  "dotnet",
  // Mobile.
  "android",
  "ios",
  "flutter",
  "ionic",
  "xamarin",
  "swiftui",
  // Cloud / DevOps / infra.
  "aws",
  "gcp",
  "azure",
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "ansible",
  "jenkins",
  "circleci",
  "nginx",
  "apache",
  "serverless",
  "lambda",
  "ec2",
  "s3",
  "heroku",
  "vercel",
  "netlify",
  "helm",
  "prometheus",
  "grafana",
  "datadog",
  "kafka",
  "rabbitmq",
  "redis",
  "memcached",
  // Data / databases / ML.
  "postgresql",
  "postgres",
  "mysql",
  "mariadb",
  "mongodb",
  "dynamodb",
  "cassandra",
  "elasticsearch",
  "sqlite",
  "snowflake",
  "redshift",
  "bigquery",
  "spark",
  "hadoop",
  "airflow",
  "pandas",
  "numpy",
  "tensorflow",
  "pytorch",
  // Practices / protocols / tooling.
  "rest",
  "restful",
  "graphql",
  "grpc",
  "websocket",
  "websockets",
  "oauth",
  "jwt",
  "saml",
  "sso",
  "microservices",
  "monorepo",
  "mvc",
  "mvvm",
  "oop",
  "tdd",
  "bdd",
  "devops",
  "agile",
  "scrum",
  "kanban",
  "jira",
  "git",
  "github",
  "gitlab",
  "bitbucket",
  "linux",
  "unix",
  "figma",
  "sketch",
  "accessibility",
  "a11y",
  "seo",
  "pwa",
  "spa",
  "ssr",
  "wasm",
  "observability",
  // Domain / general-tech terms an ATS keys on.
  "frontend",
  "backend",
  "fullstack",
  "api",
  "ui",
  "ux",
  "erp",
  "crm",
  "cms",
  "saas",
  "etl",
  "orm",
  "cdn",
  "http",
  "https",
  "ssl",
  "json",
  "xml",
  "yaml",
  "regex",
  "caching",
  "scalability",
  "scalable",
  "performance",
  "optimization",
  "latency",
  "debugging",
  "refactoring",
  "deployment",
  "pipeline",
  "automation",
  "testing",
  "integration",
  "authentication",
  "authorization",
  "encryption",
  "security",
  "database",
  "framework",
  "component",
  "responsive",
  "prototyping",
  "website",
  "web",
]);

/**
 * Multiword technical skills, detected as units (single tokens would lose the
 * meaning). Lowercased; matched as substrings of the lowercased text.
 */
const SKILL_PHRASES = [
  "machine learning",
  "deep learning",
  "data science",
  "data analysis",
  "data engineering",
  "ci/cd",
  "continuous integration",
  "continuous deployment",
  "continuous delivery",
  "react native",
  "node.js",
  "next.js",
  "nuxt.js",
  "vue.js",
  "rest api",
  "restful api",
  "graphql api",
  "web api",
  "unit testing",
  "integration testing",
  "end to end",
  "test driven",
  "test-driven development",
  "object oriented",
  "object-oriented",
  "functional programming",
  "design patterns",
  "data structures",
  "system design",
  "distributed systems",
  "cloud computing",
  "version control",
  "natural language processing",
  "computer vision",
  "ruby on rails",
  "spring boot",
  "asp.net",
  ".net core",
  "entity framework",
  "amazon web services",
  "google cloud",
  "microsoft azure",
  "infrastructure as code",
  "message queue",
  "event driven",
  "single page application",
  "server side rendering",
  "client side rendering",
  "static site generation",
  "user experience",
  "user interface",
  "responsive design",
  "cross functional",
  "cross-functional",
  "web development",
  "web application",
  "web applications",
  "frontend development",
  "front end",
  "front-end",
  "back end",
  "back-end",
  "full stack",
  "full-stack",
  "load balancing",
  "high availability",
  "code review",
  "pair programming",
  "progressive web app",
  "project management",
  "product management",
];

/** Short tokens that are meaningful despite being under the length floor. */
const SHORT_ALLOW = new Set([
  "go",
  "ai",
  "ml",
  "ci",
  "cd",
  "qa",
  "ux",
  "ui",
  "js",
  "ts",
  "db",
  "os",
  "aws",
  "gcp",
  "sql",
  "css",
  "api",
  "git",
  "php",
  "c++",
  "c#",
  "io",
]);

const TOKEN_RE = /[a-z][a-z0-9+#.]*[a-z0-9+#]|[a-z]/g;

/** How much a skill keyword counts toward the score vs. a generic keyword. */
const SKILL_WEIGHT = 3;
const GENERAL_WEIGHT = 1;
/** Keep all skills (up to this many) before filling with generic terms. */
const MAX_SKILLS = 40;
/** Cap on generic (non-skill) keywords so skills dominate the score. */
const MAX_GENERAL = 25;

interface KeywordInfo {
  term: string;
  freq: number;
  isSkill: boolean;
}

/**
 * Rank keywords from free text. Multiword skill phrases are detected first, then
 * single tokens. Recognised skills always sort ahead of generic words; ties
 * break by frequency (desc) then alphabetically.
 */
function rankKeywords(text: string): KeywordInfo[] {
  const lower = text.toLowerCase();
  const freq = new Map<string, number>();
  const skillTerms = new Set<string>();

  for (const phrase of SKILL_PHRASES) {
    let from = 0;
    let count = 0;
    let idx: number;
    while ((idx = lower.indexOf(phrase, from)) !== -1) {
      count++;
      from = idx + phrase.length;
    }
    if (count) {
      freq.set(phrase, (freq.get(phrase) ?? 0) + count);
      skillTerms.add(phrase);
    }
  }

  const tokens = lower.match(TOKEN_RE) ?? [];
  for (const tok of tokens) {
    const t = tok.replace(/\.$/, "");
    if (STOPWORDS.has(t)) continue;
    // Fold a plural to its singular when the singular is a known skill
    // (e.g. "apis" -> "api", "websites" -> "website"), so we never double-count
    // or show both forms. Safe: it only triggers when the singular is a skill.
    let term = t;
    let isSkill = SKILL_TOKENS.has(t);
    if (!isSkill && t.endsWith("s") && SKILL_TOKENS.has(t.slice(0, -1))) {
      term = t.slice(0, -1);
      isSkill = true;
    }
    if (!isSkill && term.length < 3 && !SHORT_ALLOW.has(term)) continue;
    if (/^\d+$/.test(term)) continue;
    freq.set(term, (freq.get(term) ?? 0) + 1);
    if (isSkill) skillTerms.add(term);
  }

  return [...freq.entries()]
    .map(([term, f]) => ({ term, freq: f, isSkill: skillTerms.has(term) }))
    .sort((a, b) => {
      if (a.isSkill !== b.isSkill) return a.isSkill ? -1 : 1;
      return b.freq - a.freq || a.term.localeCompare(b.term);
    });
}

/**
 * Extract ranked, de-duplicated keywords from free text (skills first). Kept for
 * back-compat; {@link analyzeMatch} uses the richer {@link rankKeywords}.
 */
export function extractKeywords(text: string): string[] {
  return rankKeywords(text).map((k) => k.term);
}

/** Does `keyword` appear in the (already lowercased) CV text? */
function present(keyword: string, cvLower: string): boolean {
  if (keyword.includes(" ") || /[.+#/]/.test(keyword)) {
    return cvLower.includes(keyword);
  }
  // Word-boundary match, tolerant of a trailing plural "s" so "component"
  // matches "components". The required keyword is unchanged, so \b still stops
  // "java" matching "javascript" and "ios" can't match a bare "io".
  const re = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`,
  );
  return re.test(cvLower);
}

/**
 * Compare a CV against a job description. Pure & deterministic.
 *
 * Every recognised skill in the JD is kept (capped at {@link MAX_SKILLS}), plus
 * the top generic terms ({@link MAX_GENERAL}). Skills are listed first and count
 * {@link SKILL_WEIGHT}× toward the score, so the percentage reflects coverage of
 * the terms that actually matter — not coincidental overlap with filler words.
 */
export function analyzeMatch(cv: CvData, jd: string): AtsResult {
  const ranked = rankKeywords(jd);
  const skills = ranked.filter((k) => k.isSkill).slice(0, MAX_SKILLS);
  const general = ranked.filter((k) => !k.isSkill).slice(0, MAX_GENERAL);
  const selected = [...skills, ...general]; // skills first

  const cvLower = cvToPlainText(cv).toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;
  for (const kw of selected) {
    const weight = kw.isSkill ? SKILL_WEIGHT : GENERAL_WEIGHT;
    totalWeight += weight;
    if (present(kw.term, cvLower)) {
      matched.push(kw.term);
      matchedWeight += weight;
    } else {
      missing.push(kw.term);
    }
  }

  const score =
    totalWeight === 0 ? 0 : Math.round((100 * matchedWeight) / totalWeight);

  return {
    score,
    matched,
    missing,
    jdKeywords: selected.map((k) => k.term),
    skillKeywords: skills.map((k) => k.term),
  };
}
