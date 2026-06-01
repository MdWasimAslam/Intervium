import { z } from "zod";
import { type CvData } from "@/lib/cv/types";
import { fnv1a, stableStringify } from "@/lib/cv/parse";
import { logAiCall } from "@/lib/ai-logging";

/** A clean, UI-safe error for any generation failure. */
export class QuestionGenerationError extends Error {}

// Fast is for cheap/high-volume generation. Smart is for judgment-heavy tasks.
const FAST_MODEL =
  process.env.GROQ_FAST_MODEL?.trim() || "llama-3.1-8b-instant";
const SMART_MODEL =
  process.env.GROQ_SMART_MODEL?.trim() || "llama-3.3-70b-versatile";
const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
type GroqModelTier = "fast" | "smart";

/**
 * Which AI backend a call uses. Both speak the OpenAI chat-completions wire
 * format, so the only differences are the base URL, API key and model name —
 * everything else (retry, timeout, JSON parsing, usage logging) is shared.
 */
export type AiProvider = "groq" | "deepseek";

const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";

/** Resolve the endpoint, key and model for a provider (throws if unconfigured). */
function resolveProvider(
  provider: AiProvider,
  tier: GroqModelTier,
): { apiKey: string; url: string; model: string; label: string } {
  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw new QuestionGenerationError(
        "DeepSeek is not configured (missing DEEPSEEK_API_KEY).",
      );
    }
    const base = (
      process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    return {
      apiKey,
      url: `${base}/chat/completions`,
      model: process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL,
      label: "DeepSeek",
    };
  }
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new QuestionGenerationError(
      "Groq is not configured (missing GROQ_API_KEY).",
    );
  }
  return {
    apiKey,
    url: GROQ_CHAT_COMPLETIONS_URL,
    model: tier === "smart" ? SMART_MODEL : FAST_MODEL,
    label: "Groq",
  };
}

/** HTTP statuses worth retrying — transient timeouts, rate limits, gateway/server errors. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
/** Per-request timeout, kept below the 60s function limit. */
const GROQ_REQUEST_TIMEOUT_MS = 25_000;
/** Transient-failure retry policy (layered under the JSON-validation retries). */
const MAX_TRANSIENT_ATTEMPTS = 3;
/** Cap any single backoff wait (incl. a Retry-After hint) so we stay under the function limit. */
const MAX_BACKOFF_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into ms, capped. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(0, seconds * 1000), MAX_BACKOFF_MS);
  }
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    return Math.min(Math.max(0, when - Date.now()), MAX_BACKOFF_MS);
  }
  return null;
}

interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  // Groq returns token counts here when available.
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

/** AI-interview calibration target (replaces the old difficulty bands). */
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

/** Profession category — gates technical vs. domain-appropriate prompts. */
export type ProfessionType =
  | "technical"
  | "hr"
  | "sales"
  | "marketing"
  | "other";

/** Interviewer persona label per profession (used in generation + scoring). */
const PROFESSION_LABEL: Record<ProfessionType, string> = {
  technical: "technical",
  hr: "HR",
  sales: "Sales",
  marketing: "Marketing",
  other: "professional",
};

/** Editor languages a coding question may use (bank coding defaults to JS). */
export const CODING_LANGUAGES = ["javascript", "typescript"] as const;
export type CodingLanguage = (typeof CODING_LANGUAGES)[number];
export const DEFAULT_CODING_LANGUAGE: CodingLanguage = "javascript";

/** Strict schema for the model's JSON output. AI interviews are technical text. */
const questionsSchema = z
  .array(
    z.object({
      question_text: z.string().trim().min(1),
      ideal_answer: z.string().trim().min(1),
    }),
  )
  .min(1);

export type GeneratedQuestion = z.infer<typeof questionsSchema>[number];

export interface GenerationContext {
  roleName: string;
  techStack: string;
  skillLevel: SkillLevel;
  count: number;
  yearsExperience: number;
  skills: string[];
  targetRole: string;
  cvText: string;
  /** Attributes the generation call in the AI Usage dashboard. */
  userId?: string | null;
  /** Profession category; non-technical values switch the prompt framing. */
  professionType?: ProfessionType;
}

/** Lazily create the client so the build never needs the key. */
function getModel(
  opts: {
    json?: boolean;
    temperature?: number;
    tier?: GroqModelTier;
    /** AI backend for this call. Defaults to Groq. */
    provider?: AiProvider;
    /** Feature label for usage logging; omit to skip logging this call. */
    feature?: string;
    /** User the call is attributed to (for the AI Usage dashboard). */
    userId?: string | null;
    /**
     * Optional best-effort determinism seed. Sent to the model only when set,
     * so variety-seeking callers (interview generation) are unaffected.
     */
    seed?: number;
  } = {},
) {
  const {
    json = true,
    temperature = 0.9,
    tier = "fast",
    provider = "groq",
    feature,
    userId,
    seed,
  } = opts;
  const { apiKey, url, model, label } = resolveProvider(provider, tier);

  // Record one usage-log row per logical call (success carries token counts;
  // terminal failures log a status="error" row). No-op when feature is unset.
  const emit = (
    status: "success" | "error",
    usage?: GroqChatResponse["usage"],
  ) =>
    feature
      ? logAiCall({
          userId,
          feature,
          model,
          status,
          inputTokens: usage?.prompt_tokens ?? null,
          outputTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
        })
      : Promise.resolve();

  return {
    async generateContent(prompt: string): Promise<string> {
      const systemPrompt = json
        ? "Return only valid JSON matching the user's requested shape. Do not include markdown, code fences, or explanatory prose."
        : "Follow the user's output instructions exactly. Keep the response concise.";

      const body = JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        stream: false,
        // Best-effort determinism: same input → same seed → (ideally) same
        // output. Groq doesn't hard-guarantee this, so the CV action layer
        // also content-caches results — but the seed makes repeats far stabler.
        ...(seed !== undefined ? { seed } : {}),
      });

      // Transient-retry loop (429/5xx/408 + network/timeout) with exponential
      // backoff + jitter. The per-attempt timeout (25s) aborts a hung request
      // so a single call can never eat the whole 60s function budget. The
      // JSON-validation retry loops in the callers sit on top of this.
      try {
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
          let res: Response;
          try {
            res = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body,
              signal: AbortSignal.timeout(GROQ_REQUEST_TIMEOUT_MS),
            });
          } catch (error) {
            // Network failure or the abort timeout firing — both are transient.
            const isTimeout =
              error instanceof Error &&
              (error.name === "TimeoutError" || error.name === "AbortError");
            lastError = isTimeout
              ? new Error(`${label} request timed out`)
              : error;
            if (attempt < MAX_TRANSIENT_ATTEMPTS) {
              await sleep(
                Math.min(2 ** (attempt - 1) * 500, MAX_BACKOFF_MS) +
                  Math.random() * 200,
              );
              continue;
            }
            throw lastError;
          }

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            const err = new Error(
              `${label} ${res.status}: ${detail.slice(0, 500)}`,
            );
            if (
              RETRYABLE_STATUSES.has(res.status) &&
              attempt < MAX_TRANSIENT_ATTEMPTS
            ) {
              lastError = err;
              const retryAfter =
                res.status === 429
                  ? parseRetryAfter(res.headers.get("retry-after"))
                  : null;
              const backoff =
                retryAfter ??
                Math.min(2 ** (attempt - 1) * 500, MAX_BACKOFF_MS);
              await sleep(backoff + Math.random() * 200);
              continue;
            }
            throw err;
          }

          const data = (await res.json()) as GroqChatResponse;
          const text = data.choices?.[0]?.message?.content?.trim();
          if (!text) {
            throw new Error(
              data.error?.message ?? `${label} returned an empty response.`,
            );
          }
          await emit("success", data.usage);
          return text;
        }

        // Exhausted transient retries.
        throw lastError instanceof Error
          ? lastError
          : new Error(`${label} request failed after retries.`);
      } catch (error) {
        // Terminal failure for this call — record an error row, then rethrow.
        await emit("error");
        throw error;
      }
    },
  };
}

/**
 * Depth spec for a (non-coding) "ideal_answer". The field stays a single
 * string, but we require a structured, multi-point model answer instead of a
 * 1-2 sentence gloss. The scorer grades against this reference, so a shallow
 * ideal answer was a root cause of over-generous scores — a rich one gives the
 * grader the concepts a strong answer should contain.
 */
const DEPTH_BY_LEVEL: Record<SkillLevel, string> = {
  beginner: "5-8 bullets",
  intermediate: "8-12 bullets",
  advanced: "10-15 bullets",
  expert: "12-18 bullets",
};

function idealAnswerSpec(skillLevel: SkillLevel): string {
  return [
    ``,
    `For each question, "ideal_answer" must be a COMPREHENSIVE model answer (NOT 1-2 sentences) that a strong candidate would give. Write it as clearly separated "- " bullet points (use "\\n" between them inside the JSON string) covering, where relevant:`,
    `- Core definition / direct answer`,
    `- Key concepts and how they actually work`,
    `- Important interview points an evaluator listens for`,
    `- Common pitfalls or misconceptions`,
    `- A short, concrete practical example`,
    `- 1-2 natural follow-up discussion topics`,
    `Scale the DEPTH to the "${skillLevel}" level (${DEPTH_BY_LEVEL[skillLevel]}).`,
  ].join("\n");
}

export function buildPrompt(ctx: GenerationContext, strict: boolean): string {
  const cv = ctx.cvText ? ctx.cvText.slice(0, 2000) : "";
  const type = ctx.professionType ?? "technical";
  const isTechnical = type === "technical";

  // Intro framing differs by profession: technical interviews ask about the
  // tech stack; non-technical ones assess domain knowledge, scenarios, and
  // behavioural competencies (never coding).
  const intro = isTechnical
    ? [
        `You are an expert interviewer creating a mock interview for a ${ctx.roleName}.`,
        `Generate exactly ${ctx.count} TECHNICAL interview questions (answered in text, not coding puzzles).`,
        `Ask questions specific to the tech stack — concepts, problem-solving, and trade-offs.`,
      ]
    : [
        `You are an expert ${PROFESSION_LABEL[type]} interviewer creating a mock interview for a ${ctx.roleName}.`,
        `Generate exactly ${ctx.count} interview questions (answered in text) that assess real-world competence for this role.`,
        `Cover domain knowledge, situational/scenario judgement, behavioural competencies, and best practices relevant to the specialization. Do NOT ask coding or programming puzzles.`,
      ];
  const specializationLabel = isTechnical
    ? "Tech stack"
    : "Specialization / focus";

  return [
    ...intro,
    ``,
    `Configuration:`,
    `- ${specializationLabel}: ${ctx.techStack}`,
    `- Skill level: ${ctx.skillLevel} (calibrate depth accordingly — a Beginner question should be noticeably easier than an Expert one).`,
    ``,
    `Candidate context (use to make questions relevant, do not quote verbatim):`,
    `- Years of experience: ${ctx.yearsExperience}`,
    ctx.skills.length
      ? `- Skills: ${ctx.skills.join(", ")}`
      : `- Skills: (none listed)`,
    ctx.targetRole ? `- Goal: ${ctx.targetRole}` : ``,
    cv ? `- CV excerpt: """${cv}"""` : ``,
    idealAnswerSpec(ctx.skillLevel),
    ``,
    strict
      ? `CRITICAL: Respond with ONLY a raw JSON array. No markdown, no code fences, no commentary. Each element must be an object with exactly "question_text" and "ideal_answer" string fields.`
      : `Respond as a JSON array of objects with "question_text" and "ideal_answer" string fields. No markdown.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Remove accidental ```json … ``` fences if the model adds them. */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonCandidate(text: string): string {
  const stripped = stripFences(text);
  const start = stripped.search(/[\[{]/);
  if (start < 0) return stripped;

  const opener = stripped[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === opener) {
      depth++;
    } else if (ch === closer) {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }

  return stripped.slice(start);
}

function escapeControlCharsInJsonStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code >= 0x00 && code <= 0x1f) {
        switch (ch) {
          case "\b":
            out += "\\b";
            break;
          case "\f":
            out += "\\f";
            break;
          case "\n":
            out += "\\n";
            break;
          case "\r":
            out += "\\r";
            break;
          case "\t":
            out += "\\t";
            break;
          default:
            out += `\\u${code.toString(16).padStart(4, "0")}`;
        }
        continue;
      }
    } else if (ch === '"') {
      inString = true;
    }

    out += ch;
  }

  return out;
}

function parseModelJson(raw: string): unknown {
  const candidate = extractJsonCandidate(raw);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(escapeControlCharsInJsonStrings(candidate));
  }
}

/**
 * Generate questions via Groq. Retries once with a stricter instruction if
 * the output fails JSON/zod validation. Throws QuestionGenerationError on
 * network/quota errors or repeated invalid output.
 */
export async function generateQuestions(
  ctx: GenerationContext,
): Promise<GeneratedQuestion[]> {
  const model = getModel({
    tier: "fast",
    feature: "question_gen",
    userId: ctx.userId,
  });
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(buildPrompt(ctx, attempt === 2));
    } catch (error) {
      // Network / quota / auth failures — surface a clean message.
      console.error("[groq] request failed:", error);
      throw new QuestionGenerationError(
        "We couldn't generate questions right now. Please try again.",
      );
    }

    try {
      return questionsSchema.parse(parseModelJson(raw));
    } catch (error) {
      lastIssue = error;
      console.warn(`[groq] invalid output on attempt ${attempt}, retrying...`);
    }
  }

  console.error("[groq] giving up after retries:", lastIssue);
  throw new QuestionGenerationError(
    "We couldn't generate questions right now. Please try again.",
  );
}

/* -------------------------------------------------------------------------- */
/* Scoring (Phase 8)                                                          */
/* -------------------------------------------------------------------------- */

/** Clean error for scoring failures (caught per-question → fallback score). */
export class ScoringError extends Error {}

/* --- Structured interviewer rubric --------------------------------------- *
 * Scores are no longer a single subjective number the model invents. The model
 * grades discrete rubric components and we DERIVE the /10 total in code, so a
 * thin "keyword" answer can never be handed a 9 the breakdown doesn't justify.
 *
 *   Text/behavioural answers — components SUM to 10:
 *     technicalAccuracy (0-4) + completeness (0-3)
 *     + communicationClarity (0-2) + interviewReadiness (0-1)
 *
 *   Coding answers — components are each 0-10 and combined with fixed weights:
 *     correctness 40% + approach 25% + edgeCases 20% + readability 15%
 * ------------------------------------------------------------------------- */

const textRubricSchema = z.object({
  technicalAccuracy: z.number().int().min(0).max(4),
  completeness: z.number().int().min(0).max(3),
  communicationClarity: z.number().int().min(0).max(2),
  interviewReadiness: z.number().int().min(0).max(1),
});
export type TextRubric = z.infer<typeof textRubricSchema>;

const codeRubricSchema = z.object({
  correctness: z.number().int().min(0).max(10),
  approach: z.number().int().min(0).max(10),
  edgeCases: z.number().int().min(0).max(10),
  readability: z.number().int().min(0).max(10),
});
export type CodeRubric = z.infer<typeof codeRubricSchema>;

/** Fixed weights for the coding rubric (sum to 1). */
const CODE_WEIGHTS = {
  correctness: 0.4,
  approach: 0.25,
  edgeCases: 0.2,
  readability: 0.15,
} as const;

/** Feedback fields every score shape carries. */
const feedbackFields = {
  feedback: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).max(10),
  improvements: z.array(z.string().trim().min(1)).max(10),
  // Concepts the ideal answer covers that the candidate's answer missed or got
  // wrong. Drives the "Missing concepts" results section (score transparency).
  // Optional so older prompts / partial model output never fail validation.
  missingConcepts: z.array(z.string().trim().min(1)).max(12).default([]),
};

/** What the model returns for a text answer (rubric + feedback, no total). */
const textScoreSchema = textRubricSchema.extend(feedbackFields);
/** What the model returns for a coding answer (rubric + feedback, no total). */
const codeScoreSchema = codeRubricSchema.extend({
  ...feedbackFields,
  // A stronger/cleaner alternative solution, when the candidate's approach is
  // suboptimal. Empty string when their approach is already idiomatic.
  betterApproach: z.string().trim().default(""),
});

/**
 * Resolved score the pipeline persists. `score` is ALWAYS derived here from the
 * rubric (never trusted from the model). `rubric`/`codeRubric` are carried
 * through so the results UI can show the breakdown.
 */
export interface AnswerScore {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  /** Concepts the answer missed (from the ideal answer). May be empty. */
  missingConcepts: string[];
  /** Coding only: a stronger alternative solution, when applicable. */
  betterApproach?: string;
  rubric?: TextRubric;
  codeRubric?: CodeRubric;
}

/** Sum the four text-rubric components into a 0-10 total. */
export function textTotal(r: TextRubric): number {
  return (
    r.technicalAccuracy +
    r.completeness +
    r.communicationClarity +
    r.interviewReadiness
  );
}

/** Weight the four code-rubric components into a 0-10 total. */
export function codeTotal(r: CodeRubric): number {
  const weighted =
    r.correctness * CODE_WEIGHTS.correctness +
    r.approach * CODE_WEIGHTS.approach +
    r.edgeCases * CODE_WEIGHTS.edgeCases +
    r.readability * CODE_WEIGHTS.readability;
  return Math.max(0, Math.min(10, Math.round(weighted)));
}

/** Map a parsed text-rubric object to the resolved {@link AnswerScore}. */
function toTextScore(p: z.infer<typeof textScoreSchema>): AnswerScore {
  const rubric: TextRubric = {
    technicalAccuracy: p.technicalAccuracy,
    completeness: p.completeness,
    communicationClarity: p.communicationClarity,
    interviewReadiness: p.interviewReadiness,
  };
  return {
    score: textTotal(rubric),
    feedback: p.feedback,
    strengths: p.strengths,
    improvements: p.improvements,
    missingConcepts: p.missingConcepts,
    rubric,
  };
}

/** Map a parsed code-rubric object to the resolved {@link AnswerScore}. */
function toCodeScore(p: z.infer<typeof codeScoreSchema>): AnswerScore {
  const codeRubric: CodeRubric = {
    correctness: p.correctness,
    approach: p.approach,
    edgeCases: p.edgeCases,
    readability: p.readability,
  };
  return {
    score: codeTotal(codeRubric),
    feedback: p.feedback,
    strengths: p.strengths,
    improvements: p.improvements,
    missingConcepts: p.missingConcepts,
    betterApproach: p.betterApproach || undefined,
    codeRubric,
  };
}

/**
 * The shared interviewer rubric + calibration block injected into every
 * text-answer scoring prompt (single and batch) so both paths grade
 * identically. Difficulty is woven in so the bar tracks the seniority band.
 */
function textRubricInstructions(
  difficulty: string,
  professionType: ProfessionType = "technical",
): string[] {
  const isTechnical = professionType === "technical";
  const persona = isTechnical
    ? `Evaluate like a senior interviewer at a top engineering company.`
    : `Evaluate like a senior ${PROFESSION_LABEL[professionType]} interviewer at a top employer.`;
  return [
    `${persona} Be rigorous: reward genuine understanding, NOT keyword-matching. A short answer that merely names the right terms is not a strong answer.`,
    ``,
    `Grade with this STRUCTURED RUBRIC. The four components SUM to the /10 total — do not output a total yourself, just the four numbers:`,
    isTechnical
      ? `- "technicalAccuracy" (0-4): Are the stated concepts correct and precise? Deduct for any factual mistake, vagueness, or imprecision.`
      : `- "technicalAccuracy" (0-4): Are the stated facts, judgements, and recommendations correct and precise for this domain (coding is NOT expected)? Deduct for any factual mistake, vagueness, or imprecision.`,
    `- "completeness" (0-3): Did they address every part of the question and the important sub-concepts? Deduct for missing key points even when what they did say is correct.`,
    `- "communicationClarity" (0-2): Is the answer clearly structured, well-worded, and unambiguous?`,
    `- "interviewReadiness" (0-1): Would a real interviewer be satisfied and move on? Award 1 ONLY for a genuinely solid, convincing answer.`,
    ``,
    `Calibration for the resulting /10 total:`,
    `- 9-10: Exceptional — accurate, complete, demonstrates strong, deep understanding.`,
    `- 7-8: Good — mostly correct with only minor omissions.`,
    `- 5-6: Partially correct — missing important details or examples.`,
    `- 3-4: Major gaps — shows limited understanding.`,
    `- 0-2: Incorrect or largely irrelevant.`,
    ``,
    `HARD RULES (never violate):`,
    `- NEVER award a 9 or 10 to a short, keyword-only answer that lacks explanation, depth, or examples.`,
    `- NEVER award 8+ when any major concept the question asks about is missing.`,
    `- A correct-but-incomplete answer belongs around 5-6, not 8-9. Reward partial credit fairly, but do not inflate.`,
    `- Judge depth of understanding, not the presence of buzzwords.`,
    `- Calibrate to the "${difficulty}" band: judge a Junior answer by Junior expectations and a Senior answer by Senior expectations. Do NOT penalise a Junior for lacking Senior-level depth, but do NOT inflate a thin answer just because the candidate is Junior.`,
    ``,
    `Feedback rules:`,
    `- "feedback" MUST reference specific content from THIS candidate's answer (quote or paraphrase what they actually said) and MUST explain WHY points were lost in each weak rubric area. No generic praise.`,
    `- "strengths"/"improvements": short, specific, grounded in what they actually wrote.`,
  ];
}

/**
 * Few-shot calibration so the model anchors on interviewer-grade severity.
 * The breakdowns are internally consistent (components sum to the stated
 * total) and deliberately include the array-vs-object case that was
 * over-scoring at 6 → corrected to a 4.
 */
const TEXT_SCORING_EXAMPLES: string[] = [
  `Calibration examples — study the SEVERITY and logic, do not copy the wording:`,
  ``,
  `Example 1`,
  `Q: "What is the difference between let and var?"`,
  `A: "let is block scoped and var is function scoped"`,
  `Grade: technicalAccuracy 3, completeness 1, communicationClarity 2, interviewReadiness 0 → total 6.`,
  `Why: Correct but incomplete — names scoping correctly yet omits hoisting, the temporal dead zone, and redeclaration rules. Not enough to satisfy an interviewer.`,
  ``,
  `Example 2`,
  `Q: "What is the difference between let and var?"`,
  `A: "let is block scoped, cannot be redeclared in the same scope and exists in the temporal dead zone. var is function scoped, hoisted and initialized with undefined."`,
  `Grade: technicalAccuracy 4, completeness 3, communicationClarity 1, interviewReadiness 1 → total 9.`,
  `Why: Accurate and sufficiently complete (scope, redeclaration, TDZ, hoisting). Loses one clarity point only for giving no concrete example.`,
  ``,
  `Example 3`,
  `Q: "What is the difference between an array and an object in JavaScript?"`,
  `A: "arrays and object both are non primitive data type, arrays are used to store multiple value, object is used to store key value pairs"`,
  `Grade: technicalAccuracy 2, completeness 1, communicationClarity 1, interviewReadiness 0 → total 4.`,
  `Why: States two surface facts correctly but is imprecise and shallow — misses that arrays are ordered/indexed (and are themselves objects), iteration, built-in methods, reference semantics, and when to use each. A keyword-level answer, not interview-ready.`,
];

export interface ScoreContext {
  roleName: string;
  difficulty: string;
  question: string;
  idealAnswer: string;
  userAnswer: string;
  professionType?: ProfessionType;
}

export function scorePrompt(ctx: ScoreContext, strict: boolean): string {
  return [
    `You are a fair but rigorous senior interviewer evaluating a candidate's answer for a ${ctx.roleName} role.`,
    ``,
    ...textRubricInstructions(ctx.difficulty, ctx.professionType),
    ``,
    ...TEXT_SCORING_EXAMPLES,
    ``,
    `Now grade this answer:`,
    `Question: ${ctx.question}`,
    `Reference / ideal answer: ${ctx.idealAnswer}`,
    `Candidate answer: ${ctx.userAnswer}`,
    ``,
    `Return a JSON object with:`,
    `- "technicalAccuracy": integer 0-4`,
    `- "completeness": integer 0-3`,
    `- "communicationClarity": integer 0-2`,
    `- "interviewReadiness": integer 0-1`,
    `- "feedback": 2-4 sentences referencing the candidate's actual words and explaining why points were lost`,
    `- "strengths": array of short strings (may be empty)`,
    `- "improvements": array of short strings (may be empty)`,
    `- "missingConcepts": array of short strings — specific concepts/points from the reference answer that the candidate did NOT cover or got wrong (empty array if they covered everything important). Name the concept, not a sentence.`,
    `Do NOT include a "score" field — the total is computed from the four rubric numbers.`,
    strict
      ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences, no prose.`
      : `Respond as a JSON object only. No markdown.`,
  ].join("\n");
}

/** Score one answer. Throws ScoringError on network/quota or repeated bad output. */
export async function scoreAnswer(ctx: ScoreContext): Promise<AnswerScore> {
  const model = getModel({ json: true, temperature: 0.3, tier: "smart" });
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(scorePrompt(ctx, attempt === 2));
    } catch (error) {
      console.error("[groq:score] request failed:", error);
      throw new ScoringError("Scoring request failed.");
    }
    try {
      return toTextScore(textScoreSchema.parse(parseModelJson(raw)));
    } catch (error) {
      lastIssue = error;
      console.warn(`[groq:score] invalid output on attempt ${attempt}`);
    }
  }
  console.error("[groq:score] giving up:", lastIssue);
  throw new ScoringError("Scoring produced invalid output.");
}

/* -------------------------------------------------------------------------- */
/* Batch scoring — one Groq call for a whole session's answers.               */
/* -------------------------------------------------------------------------- */

/** One answered question to grade, identified by its session_questions row id. */
export interface BatchScoreItem {
  id: string;
  question: string;
  idealAnswer: string;
  userAnswer: string;
}

/** textScoreSchema plus the row id the model must echo back, so we can map results. */
const batchTextSchema = z.array(
  textScoreSchema.extend({ id: z.string().trim().min(1) }),
);
/** codeScoreSchema plus the row id, for the code-scoring batch. */
const batchCodeSchema = z.array(
  codeScoreSchema.extend({ id: z.string().trim().min(1) }),
);

export function batchScorePrompt(
  roleName: string,
  difficulty: string,
  items: BatchScoreItem[],
  strict: boolean,
  professionType: ProfessionType = "technical",
): string {
  const blocks = items
    .map((it, i) =>
      [
        `--- Item ${i + 1} ---`,
        `id: ${it.id}`,
        `Question: ${it.question}`,
        `Reference / ideal answer: ${it.idealAnswer}`,
        `Candidate answer: ${it.userAnswer}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `You are a fair but rigorous senior interviewer evaluating a candidate's answers for a ${roleName} role.`,
    `Grade the ${items.length} answers below. Score EACH one independently and consistently.`,
    ``,
    ...textRubricInstructions(difficulty, professionType),
    ``,
    ...TEXT_SCORING_EXAMPLES,
    ``,
    `Answers to grade:`,
    blocks,
    ``,
    `Return a JSON array with exactly one object per item above, each containing:`,
    `- "id": the exact id string from the matching item, echoed verbatim`,
    `- "technicalAccuracy": integer 0-4`,
    `- "completeness": integer 0-3`,
    `- "communicationClarity": integer 0-2`,
    `- "interviewReadiness": integer 0-1`,
    `- "feedback": 2-4 sentences referencing the candidate's actual words and explaining why points were lost`,
    `- "strengths": array of short strings (may be empty)`,
    `- "improvements": array of short strings (may be empty)`,
    `- "missingConcepts": array of short strings — specific concepts/points from the reference answer that the candidate did NOT cover or got wrong (empty array if they covered everything important). Name the concept, not a sentence.`,
    `Do NOT include a "score" field — the total is computed from the four rubric numbers.`,
    `Include every id exactly once. Do not merge, reorder-away, or omit any item.`,
    strict
      ? `CRITICAL: Respond with ONLY the raw JSON array. No markdown, no code fences, no prose.`
      : `Respond as a JSON array only. No markdown.`,
  ].join("\n");
}

/**
 * Score every answered question in a session with a SINGLE Groq call
 * (replacing one-call-per-answer — the dominant free-tier quota cost).
 * Returns a map of row id → score. Throws ScoringError on network/quota
 * failure or if the model can't return one valid object per id after a retry.
 */
export async function scoreAnswersBatch(
  roleName: string,
  difficulty: string,
  items: BatchScoreItem[],
  userId?: string | null,
  professionType: ProfessionType = "technical",
  provider: AiProvider = "groq",
): Promise<Map<string, AnswerScore>> {
  if (items.length === 0) return new Map();

  const model = getModel({
    json: true,
    temperature: 0.3,
    tier: "smart",
    provider,
    feature: "scoring_text",
    userId,
  });
  const requested = new Set(items.map((it) => it.id));
  // Accumulate valid per-id scores ACROSS attempts so a partial response (or a
  // second attempt that recovers some ids) is never discarded wholesale.
  const map = new Map<string, AnswerScore>();
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(
        batchScorePrompt(
          roleName,
          difficulty,
          items,
          attempt === 2,
          professionType,
        ),
      );
    } catch (error) {
      console.error("[groq:score-batch] request failed:", error);
      // If a transient retry already recovered some scores, keep them rather
      // than discarding the whole batch — the caller fills only missing ids.
      if (map.size > 0) return map;
      throw new ScoringError("Batch scoring request failed.");
    }

    try {
      const parsed = batchTextSchema.parse(parseModelJson(raw));
      // Only accept ids we actually asked for; keep the first valid score seen.
      // toTextScore derives the /10 total from the rubric components.
      for (const { id, ...rest } of parsed) {
        if (requested.has(id) && !map.has(id)) map.set(id, toTextScore(rest));
      }

      // All ids present — done. Otherwise retry only to recover the stragglers.
      if (items.every((it) => map.has(it.id))) return map;
      lastIssue = new Error("batch response missing one or more ids");
      console.warn(`[groq:score-batch] missing ids on attempt ${attempt}`);
    } catch (error) {
      lastIssue = error;
      console.warn(`[groq:score-batch] invalid output on attempt ${attempt}`);
    }
  }

  console.error("[groq:score-batch] giving up:", lastIssue);
  // Return whatever valid per-id scores we did collect; the caller applies its
  // fallback ONLY to the ids still missing (no all-or-nothing discard).
  if (map.size > 0) return map;
  throw new ScoringError("Batch scoring produced invalid output.");
}

/* -------------------------------------------------------------------------- */
/* Code scoring — one Groq call for a session's coding submissions.           */
/* -------------------------------------------------------------------------- */

/** One coding submission to grade, identified by its session_questions row id. */
export interface BatchCodeItem {
  id: string;
  question: string;
  /** Reference solution (questions_cache.ideal_answer). */
  idealSolution: string;
  /** The candidate's submitted code. */
  userCode: string;
  /** Editor language (e.g. "javascript"). */
  language: string;
}

export function batchCodePrompt(
  roleName: string,
  difficulty: string,
  items: BatchCodeItem[],
  strict: boolean,
): string {
  const blocks = items
    .map((it, i) =>
      [
        `--- Item ${i + 1} ---`,
        `id: ${it.id}`,
        `Language: ${it.language}`,
        `Problem: ${it.question}`,
        `Reference solution:`,
        "```",
        it.idealSolution,
        "```",
        `Candidate submission:`,
        "```",
        it.userCode,
        "```",
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `You are a senior engineer conducting a CODING interview for a ${roleName} role. Evaluate each submission BY READING THE CODE — you cannot execute it.`,
    `Grade the ${items.length} submission(s) below. Score EACH one independently.`,
    ``,
    `Score these FOUR dimensions, each 0-10. The /10 total is a WEIGHTED blend you do NOT compute — just give the four numbers (weights: correctness 40%, approach 25%, edge cases 20%, readability 15%):`,
    `- "correctness" (0-10): does the logic actually solve the stated problem and produce correct outputs for normal inputs?`,
    `- "approach" (0-10): is the algorithm / data-structure choice sound and reasonably efficient?`,
    `- "edgeCases" (0-10): are empty / boundary / invalid inputs, overflow, and null/undefined handled?`,
    `- "readability" (0-10): naming, structure, clarity, idiomatic use of the language.`,
    ``,
    `Grading rules:`,
    `- Judge the LOGIC, not surface syntax. Do NOT heavily penalise minor syntax slips or typos when the intended logic is clearly correct — at most dock a little from readability.`,
    `- Reward partial credit for a correct approach with minor bugs.`,
    `- The reference solution is ONE valid answer — a different but correct approach should score just as well.`,
    `- Calibrate to the difficulty band "${difficulty}" — judge a Junior submission by Junior expectations, not Senior depth.`,
    `- "feedback" MUST reference specific lines/choices in THEIR code and name concrete bugs or missed edge cases, explaining why points were lost. No generic praise.`,
    ``,
    `Submissions to grade:`,
    blocks,
    ``,
    `Return a JSON array with exactly one object per item above, each containing:`,
    `- "id": the exact id string from the matching item, echoed verbatim`,
    `- "correctness": integer 0-10`,
    `- "approach": integer 0-10`,
    `- "edgeCases": integer 0-10`,
    `- "readability": integer 0-10`,
    `- "feedback": 2-4 sentences referencing the actual code and explaining why points were lost`,
    `- "strengths": array of short strings (may be empty)`,
    `- "improvements": array of short strings (may be empty)`,
    `- "missingConcepts": array of short strings — edge cases, techniques, or considerations the submission failed to handle (empty array if none). Name the concept, not a sentence.`,
    `- "betterApproach": a short description (1-3 sentences) of a stronger or more idiomatic solution when their approach is suboptimal; empty string "" if their approach is already good.`,
    `Do NOT include a "score" field — it is computed from the weighted rubric.`,
    `Include every id exactly once. Do not merge, reorder-away, or omit any item.`,
    strict
      ? `CRITICAL: Respond with ONLY the raw JSON array. No markdown, no code fences, no prose.`
      : `Respond as a JSON array only. No markdown.`,
  ].join("\n");
}

/**
 * Score every coding submission in a session with a SINGLE Groq call, using
 * a code-aware rubric. Returns the SAME shape as {@link scoreAnswersBatch}
 * (a map of row id → AnswerScore) so the scoring pipeline is unchanged.
 * Throws ScoringError on network/quota failure or if the model can't return
 * one valid object per id after a retry.
 */
export async function scoreCodeBatch(
  roleName: string,
  difficulty: string,
  items: BatchCodeItem[],
  userId?: string | null,
  provider: AiProvider = "groq",
): Promise<Map<string, AnswerScore>> {
  if (items.length === 0) return new Map();

  const model = getModel({
    json: true,
    temperature: 0.2,
    tier: "smart",
    provider,
    feature: "scoring_code",
    userId,
  });
  const requested = new Set(items.map((it) => it.id));
  // Accumulate valid per-id scores ACROSS attempts (see scoreAnswersBatch).
  const map = new Map<string, AnswerScore>();
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(
        batchCodePrompt(roleName, difficulty, items, attempt === 2),
      );
    } catch (error) {
      console.error("[groq:score-code] request failed:", error);
      if (map.size > 0) return map;
      throw new ScoringError("Code scoring request failed.");
    }

    try {
      const parsed = batchCodeSchema.parse(parseModelJson(raw));
      // toCodeScore derives the /10 total from the weighted rubric.
      for (const { id, ...rest } of parsed) {
        if (requested.has(id) && !map.has(id)) map.set(id, toCodeScore(rest));
      }

      if (items.every((it) => map.has(it.id))) return map;
      lastIssue = new Error("code-batch response missing one or more ids");
      console.warn(`[groq:score-code] missing ids on attempt ${attempt}`);
    } catch (error) {
      lastIssue = error;
      console.warn(`[groq:score-code] invalid output on attempt ${attempt}`);
    }
  }

  console.error("[groq:score-code] giving up:", lastIssue);
  // Keep the valid per-id scores collected; caller fills only the missing ids.
  if (map.size > 0) return map;
  throw new ScoringError("Code scoring produced invalid output.");
}

export interface SummaryContext {
  roleName: string;
  difficulty: string;
  totalScore: number;
  maxScore: number;
  perQuestion: { score: number; feedback: string }[];
  userId?: string | null;
}

/**
 * Generate a one-line overall summary. Never throws — returns a sensible
 * fallback sentence on any failure.
 */
export async function generateSummary(ctx: SummaryContext): Promise<string> {
  const fallback = `You scored ${ctx.totalScore}/${ctx.maxScore} on this ${ctx.difficulty} ${ctx.roleName} interview.`;
  try {
    const model = getModel({
      json: false,
      temperature: 0.4,
      tier: "smart",
      feature: "summary_gen",
      userId: ctx.userId,
    });
    const prompt = [
      `Summarise this candidate's overall interview performance in ONE concise, encouraging-but-honest sentence.`,
      `Role: ${ctx.roleName}. Difficulty: ${ctx.difficulty}. Total: ${ctx.totalScore}/${ctx.maxScore}.`,
      `Per-question scores: ${ctx.perQuestion.map((p) => p.score).join(", ")}.`,
      `Respond with a single plain-text sentence. No JSON, no markdown, no quotes.`,
    ].join("\n");
    const text = (await model.generateContent(prompt))
      .trim()
      .replace(/^["']|["']$/g, "");
    return text || fallback;
  } catch (error) {
    console.warn("[groq:summary] failed, using fallback:", error);
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* CV feature (/cv) — qualitative AI only. Keyword scoring is done in-app.     */
/* -------------------------------------------------------------------------- */

/** Clean error for any CV generation failure. */
export class CvAiError extends Error {}

/**
 * The model id the CV features run on (the "smart" tier). Folded into the CV
 * AI cache key so a model upgrade transparently invalidates stale cached output.
 */
export function cvAiModelId(): string {
  return SMART_MODEL;
}

/** Derive a stable 32-bit integer seed from a CV feature's canonical input. */
function seedFrom(...inputs: unknown[]): number {
  return parseInt(fnv1a(stableStringify(inputs)), 16);
}

/** Run a JSON-returning Groq prompt with the standard retry-strict loop. */
async function generateJson<T>(
  schema: z.ZodType<T>,
  buildPrompt: (strict: boolean) => string,
  opts: {
    temperature?: number;
    label: string;
    feature?: string;
    userId?: string | null;
    /** Stable seed for determinism (see `getModel`). */
    seed?: number;
  },
): Promise<T> {
  const model = getModel({
    json: true,
    temperature: opts.temperature ?? 0.5,
    tier: "smart",
    feature: opts.feature,
    userId: opts.userId,
    seed: opts.seed,
  });
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(buildPrompt(attempt === 2));
    } catch (error) {
      console.error(`[groq:${opts.label}] request failed:`, error);
      throw new CvAiError(
        "We couldn't reach the AI right now. Please try again.",
      );
    }
    try {
      return schema.parse(parseModelJson(raw));
    } catch (error) {
      lastIssue = error;
      console.warn(`[groq:${opts.label}] invalid output on attempt ${attempt}`);
    }
  }

  console.error(`[groq:${opts.label}] giving up:`, lastIssue);
  throw new CvAiError(
    "The AI returned an unexpected response. Please try again.",
  );
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
      parts.push(`Job description:`, `"""${ctx.jobDescription.slice(0, 4000)}"""`);
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
    feature: "cover_letter_gen",
    userId,
  });
  try {
    const text = (await model.generateContent(coverLetterPrompt(ctx))).trim();
    if (!text) {
      throw new CvAiError("The AI returned an empty cover letter. Please try again.");
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

/* --- (e) Resume-vs-interview gap analysis (Feature 3) -------------------- */

const gapReportSchema = z.object({
  summary: z.string().trim().min(1),
  /** Skills the candidate claims AND has demonstrated in interviews. */
  validatedSkills: z.array(z.string().trim().min(1)).max(20),
  /** Claimed but untested or weakly-demonstrated skills. */
  unvalidatedSkills: z.array(z.string().trim().min(1)).max(20),
  strengths: z.array(z.string().trim().min(1)).max(10),
  weakAreas: z.array(z.string().trim().min(1)).max(10),
  /** Ordered, concrete next steps. */
  learningPath: z.array(z.string().trim().min(1)).min(1).max(10),
});

export type GapReport = z.infer<typeof gapReportSchema>;

export interface GapAnalysisContext {
  /** Skills the user lists on their profile/CV (perceived skills). */
  resumeSkills: string[];
  /** Demonstrated interview performance per specialization (0-100). */
  tested: { name: string; avgScore: number; sessionCount: number }[];
}

/**
 * ONE Groq call: compare claimed skills against demonstrated interview
 * performance and produce a gap report + learning path. Grounded strictly in
 * the provided data — it must not invent skills or scores.
 */
export async function analyzeSkillGap(
  ctx: GapAnalysisContext,
  userId?: string | null,
): Promise<GapReport> {
  const perf = ctx.tested
    .map(
      (t) =>
        `- ${t.name}: ${t.avgScore}% average over ${t.sessionCount} interview(s)`,
    )
    .join("\n");
  return generateJson(
    gapReportSchema,
    (strict) =>
      [
        `You are a career coach comparing a candidate's CLAIMED skills against their DEMONSTRATED interview performance.`,
        ``,
        `Claimed skills (from their profile/CV): ${ctx.resumeSkills.length ? ctx.resumeSkills.join(", ") : "(none listed)"}`,
        ``,
        `Demonstrated interview performance by specialization (average score out of 100):`,
        perf,
        ``,
        `Interpret scores as: 70%+ strong/validated, 50-69% partial, below 50% weak. A claimed skill with no matching interview is "unvalidated" (untested).`,
        `Be honest and specific; ground every point ONLY in the data above. Do not invent skills, specializations, or numbers.`,
        ``,
        `Return a JSON object with:`,
        `- "summary": 1-2 sentences on the overall gap between perceived and demonstrated skill`,
        `- "validatedSkills": claimed skills clearly backed by strong interview performance (may be empty)`,
        `- "unvalidatedSkills": claimed skills that are untested or only weakly demonstrated (may be empty)`,
        `- "strengths": the candidate's strongest demonstrated areas`,
        `- "weakAreas": specializations scoring below 60% that need work`,
        `- "learningPath": 3-6 concrete, ordered next steps to close the biggest gaps`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object with exactly those keys. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    { temperature: 0.4, label: "gap-analysis", feature: "gap_analysis", userId },
  );
}

/* --- Code Dojo: tiered practice hints (nudge, never solve) --------------- */

const dojoHintSchema = z.object({ hint: z.string().trim().min(1) });

export interface DojoHintContext {
  title: string;
  prompt: string;
  /** The learner's current editor contents (may be just the stub). */
  code: string;
  /** 1 = gentle nudge, 2 = name the technique, 3 = plain-English outline. */
  level: 1 | 2 | 3;
}

/** Hard guardrail: strip any code the model returns despite instructions. */
function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
}

const HINT_GUIDANCE: Record<1 | 2 | 3, string> = {
  1: "Give only a gentle conceptual nudge about the general approach or what to notice. Do NOT name the full algorithm or data structure yet.",
  2: "Point to the key data structure or algorithmic technique and the target time/space complexity. Still no code.",
  3: "Give a short step-by-step outline in plain English (prose, not code). Absolutely no syntax, no function bodies — just the ordered steps.",
};

/**
 * ONE Groq call: a single tiered hint for a Dojo problem. The model is
 * instructed never to produce a working solution, and {@link stripCode} removes
 * any code it returns anyway. Higher levels reveal progressively more.
 */
export async function getDojoHint(
  ctx: DojoHintContext,
  userId?: string | null,
): Promise<string> {
  const { hint } = await generateJson(
    dojoHintSchema,
    (strict) =>
      [
        `You are a patient coding mentor helping someone PRACTICE a data-structures/algorithms problem. Your job is to NUDGE them toward the insight, never to solve it for them.`,
        `HARD RULES: Never write working code or code snippets. Never give the complete solution. No fenced code blocks, no function bodies, no syntax. If their attempt is close, point out the conceptual mistake without fixing it for them.`,
        ``,
        `Problem: ${ctx.title}`,
        `"""${ctx.prompt.slice(0, 2000)}"""`,
        ctx.code.trim()
          ? `The learner's current attempt:\n"""${ctx.code.slice(0, 2000)}"""`
          : `The learner hasn't written anything substantial yet.`,
        ``,
        `This is hint level ${ctx.level} of 3. ${HINT_GUIDANCE[ctx.level]}`,
        `Keep it to 1-3 sentences, encouraging and specific.`,
        `Return a JSON object: { "hint": "..." }`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    { temperature: 0.4, label: "dojo-hint", feature: "dojo_hint", userId },
  );

  return stripCode(hint) || hint;
}

/* --- Code Dojo: AI-generated practice problem (draft + reference solution) - */

const dojoDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(8000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  fnName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
  starterCode: z.string().min(1).max(20000),
  topics: z.array(z.string().trim().min(1)).min(1).max(6),
  testCases: z
    .array(
      z.object({
        input: z.array(z.unknown()),
        expected: z.unknown(),
        hidden: z.boolean().optional(),
      }),
    )
    .min(3)
    .max(12),
  // A complete, correct solution — used ONLY to verify the test cases client-side,
  // never persisted.
  referenceSolution: z.string().min(1).max(20000),
});

export type DojoQuestionDraft = z.infer<typeof dojoDraftSchema>;

export interface DojoGenerateContext {
  topic?: string;
  difficulty: "easy" | "medium" | "hard";
  /** Optional free-text theme/description to base the problem on. */
  prompt?: string;
}

/**
 * ONE Groq call: generate a self-contained JavaScript practice problem for Code
 * Dojo — title, prompt, starter stub, topics, test cases, AND a working
 * reference solution. The caller verifies the reference solution against the
 * test cases (in the sandbox worker) before saving, so an inconsistent draft is
 * caught rather than persisted.
 */
export async function generateDojoQuestionDraft(
  ctx: DojoGenerateContext,
  userId?: string | null,
): Promise<DojoQuestionDraft> {
  return generateJson(
    dojoDraftSchema,
    (strict) =>
      [
        `You are an expert at authoring self-contained JavaScript data-structures/algorithms practice problems (LeetCode-style).`,
        `Produce ONE problem at ${ctx.difficulty} difficulty${ctx.topic ? ` about "${ctx.topic}"` : ""}.`,
        ctx.prompt ? `Base it on this idea: """${ctx.prompt.slice(0, 1500)}"""` : ``,
        ``,
        `Hard requirements:`,
        `- Pure, deterministic JavaScript: NO Date, Math.random, network, I/O, or global state.`,
        `- One solving function. The SAME function name ("fnName") must be defined in both "starterCode" (an empty stub) and "referenceSolution" (a complete, correct implementation).`,
        `- "testCases" is an array (3-10) of { "input": [...positional args], "expected": <value> }. CRITICAL: "input" is ALWAYS an array of the function's positional arguments — so a function taking a single array argument uses input like [[1,2,3]] (a one-element array whose element is the array). "expected" must be JSON-serializable and deterministic.`,
        `- The "referenceSolution" MUST pass every test case. Double-check the expected values by mentally executing your solution.`,
        `- "topics" are 1-3 short topic names (e.g. "Arrays", "Hash Map", "Dynamic Programming").`,
        `- "prompt" is a clear problem statement in plain text with at least one worked example.`,
        ``,
        `Return a JSON object with exactly: title, prompt, difficulty, fnName, starterCode, topics, testCases, referenceSolution.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    { temperature: 0.6, label: "dojo-generate", feature: "dojo_generate", userId },
  );
}

/* --- Code Dojo: AI review of a submitted solution ------------------------ */

const dojoReviewSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  summary: z.string().trim().min(1),
  suggestions: z.array(z.string().trim().min(1)).max(6),
});

export type DojoReview = z.infer<typeof dojoReviewSchema>;

export interface DojoReviewContext {
  title: string;
  prompt: string;
  code: string;
  /** What the in-browser test run reported (e.g. "5/6 passed; failed: …"). */
  testsSummary: string;
}

/**
 * ONE Groq call: review a SUBMITTED Dojo solution. Unlike hints (which never
 * reveal the answer), this evaluates the finished attempt — correctness against
 * the problem, edge cases, and concrete improvements. The browser-run test
 * summary is given as authoritative (the server can't execute code).
 */
export async function reviewDojoSolution(
  ctx: DojoReviewContext,
  userId?: string | null,
): Promise<DojoReview> {
  return generateJson(
    dojoReviewSchema,
    (strict) =>
      [
        `You are a senior engineer reviewing a candidate's submitted solution to a coding problem. Be honest, specific, and constructive — reference their actual code.`,
        ``,
        `Problem: ${ctx.title}`,
        `"""${ctx.prompt.slice(0, 2000)}"""`,
        ``,
        `Their submitted code:`,
        `"""${ctx.code.slice(0, 6000)}"""`,
        ``,
        `Automated test result (authoritative — you cannot run code): ${ctx.testsSummary}`,
        ``,
        `Judge correctness primarily from the test result, then from reading the code for edge cases, complexity, and clarity.`,
        `Return JSON: { "verdict": "correct" | "partial" | "incorrect", "summary": "1-3 sentence honest assessment", "suggestions": ["specific, actionable improvements (may be empty if already excellent)"] }.`,
        `Use "correct" only if it solves the problem (tests pass and the approach is sound), "partial" if it works on some cases or has notable issues, "incorrect" if it fails.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    { temperature: 0.3, label: "dojo-review", feature: "dojo_review", userId },
  );
}
