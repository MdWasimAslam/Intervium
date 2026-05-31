import { z } from "zod";
import { type CvData } from "@/lib/cv/types";

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
  error?: { message?: string };
}

/** Interview type — drives question content (and the cache signature). */
export type InterviewType = "technical" | "behavioral" | "mixed" | "coding";

/** Editor languages a coding question may use (kept small to start). */
export const CODING_LANGUAGES = ["javascript", "typescript"] as const;
export type CodingLanguage = (typeof CODING_LANGUAGES)[number];
export const DEFAULT_CODING_LANGUAGE: CodingLanguage = "javascript";

/**
 * Strict schema for the model's JSON output. `language` is only emitted for
 * coding questions (the prompt asks for it then); it stays optional so text /
 * behavioral generation is unaffected.
 */
const questionsSchema = z
  .array(
    z.object({
      question_text: z.string().trim().min(1),
      ideal_answer: z.string().trim().min(1),
      language: z.enum(CODING_LANGUAGES).optional(),
    }),
  )
  .min(1);

export type GeneratedQuestion = z.infer<typeof questionsSchema>[number];

export interface GenerationContext {
  roleName: string;
  techStack: string;
  focusArea: string;
  difficulty: string;
  interviewType: InterviewType;
  count: number;
  yearsExperience: number;
  skills: string[];
  targetRole: string;
  cvText: string;
}

/** Lazily create the client so the build never needs the key. */
function getModel(
  opts: {
    json?: boolean;
    temperature?: number;
    tier?: GroqModelTier;
  } = {},
) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new QuestionGenerationError(
      "Groq is not configured (missing GROQ_API_KEY).",
    );
  }
  const { json = true, temperature = 0.9, tier = "fast" } = opts;
  const model = tier === "smart" ? SMART_MODEL : FAST_MODEL;

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
      });

      // Transient-retry loop (429/5xx/408 + network/timeout) with exponential
      // backoff + jitter. The per-attempt timeout (25s) aborts a hung request
      // so a single call can never eat the whole 60s function budget. The
      // JSON-validation retry loops in the callers sit on top of this.
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
        let res: Response;
        try {
          res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
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
          lastError = isTimeout ? new Error("Groq request timed out") : error;
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
          const err = new Error(`Groq ${res.status}: ${detail.slice(0, 500)}`);
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
              retryAfter ?? Math.min(2 ** (attempt - 1) * 500, MAX_BACKOFF_MS);
            await sleep(backoff + Math.random() * 200);
            continue;
          }
          throw err;
        }

        const data = (await res.json()) as GroqChatResponse;
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) {
          throw new Error(
            data.error?.message ?? "Groq returned an empty response.",
          );
        }
        return text;
      }

      // Exhausted transient retries.
      throw lastError instanceof Error
        ? lastError
        : new Error("Groq request failed after retries.");
    },
  };
}

function typeInstruction(type: InterviewType): string {
  switch (type) {
    case "technical":
      return "Ask TECHNICAL questions specific to the tech stack and focus area (concepts, problem-solving, trade-offs).";
    case "behavioral":
      return "Ask BEHAVIORAL questions (past experience, collaboration, conflict, ownership) — not coding puzzles.";
    case "mixed":
      return "Ask a BLEND: roughly half technical (tech-stack specific) and half behavioral.";
    case "coding":
      return "Pose CODING problems the candidate solves in a code editor (implement a function, algorithm, or component). Each must be self-contained and solvable in JavaScript or TypeScript.";
  }
}

/**
 * Extra prompt block for coding questions: how to phrase the problem, what the
 * "ideal_answer" must contain (a complete reference solution), and the
 * `language` field the model must add to each object.
 */
function codingFormat(): string[] {
  return [
    ``,
    `CODING FORMAT (this is a coding interview):`,
    `- "question_text": a clear, self-contained problem statement. State inputs, outputs, constraints, and 1-2 concrete examples. Do NOT include the solution.`,
    `- "ideal_answer": a complete, correct, idiomatic reference SOLUTION as a code snippet (the actual implementation), plus a one-line note on its time/space complexity.`,
    `- "language": either "javascript" or "typescript" — the language your ideal_answer is written in.`,
    `- Keep each problem solvable in well under 30 minutes; no external libraries or I/O.`,
  ];
}

/**
 * Depth spec for a (non-coding) "ideal_answer". The field stays a single
 * string, but we require a structured, multi-point model answer instead of a
 * 1-2 sentence gloss. The scorer grades against this reference, so a shallow
 * ideal answer was a root cause of over-generous scores — a rich one gives the
 * grader the concepts a strong answer should contain.
 */
function idealAnswerSpec(difficulty: string): string {
  return [
    ``,
    `For each question, "ideal_answer" must be a COMPREHENSIVE model answer (NOT 1-2 sentences) that a strong candidate would give. Write it as clearly separated "- " bullet points (use "\\n" between them inside the JSON string) covering, where relevant:`,
    `- Core definition / direct answer`,
    `- Key concepts and how they actually work`,
    `- Important interview points an evaluator listens for`,
    `- Common pitfalls or misconceptions`,
    `- A short, concrete practical example`,
    `- 1-2 natural follow-up discussion topics`,
    `Scale the DEPTH to the "${difficulty}" band: Junior ≈ 5-8 bullets, Mid ≈ 8-12 bullets, Senior/Lead ≈ 10-15 bullets. Map any other band label to the nearest of these.`,
  ].join("\n");
}

function buildPrompt(ctx: GenerationContext, strict: boolean): string {
  const cv = ctx.cvText ? ctx.cvText.slice(0, 2000) : "";
  return [
    `You are an expert interviewer creating a mock interview for a ${ctx.roleName}.`,
    `Generate exactly ${ctx.count} interview questions.`,
    ``,
    `Configuration:`,
    `- Tech stack: ${ctx.techStack}`,
    `- Focus area: ${ctx.focusArea}`,
    `- Difficulty band: ${ctx.difficulty} (calibrate depth accordingly — a Junior question should be noticeably easier than a Senior/Lead one).`,
    `- Interview type: ${ctx.interviewType}. ${typeInstruction(ctx.interviewType)}`,
    ``,
    `Candidate context (use to make questions relevant, do not quote verbatim):`,
    `- Years of experience: ${ctx.yearsExperience}`,
    ctx.skills.length
      ? `- Skills: ${ctx.skills.join(", ")}`
      : `- Skills: (none listed)`,
    ctx.targetRole ? `- Goal: ${ctx.targetRole}` : ``,
    cv ? `- CV excerpt: """${cv}"""` : ``,
    ...(ctx.interviewType === "coding"
      ? codingFormat()
      : [idealAnswerSpec(ctx.difficulty)]),
    ``,
    ctx.interviewType === "coding"
      ? strict
        ? `CRITICAL: Respond with ONLY a raw JSON array. No markdown, no commentary. Each element must be an object with "question_text", "ideal_answer", and "language" string fields. The code inside ideal_answer may use newlines but the JSON itself must be valid (escape it properly).`
        : `Respond as a JSON array of objects with "question_text", "ideal_answer", and "language" string fields. No prose outside the JSON.`
      : strict
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
  const model = getModel({ tier: "fast" });
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
/* Bank generation — seed/admin question generation (no candidate context).   */
/* -------------------------------------------------------------------------- */

export interface BankGenContext {
  roleName: string;
  techStack: string;
  focusArea: string;
  difficulty: string;
  interviewType: InterviewType;
  count: number;
  /** Existing question texts for this exact config — the model is asked to avoid them. */
  avoid?: string[];
}

function buildBankPrompt(ctx: BankGenContext, strict: boolean): string {
  // Cap the avoid-list so the prompt stays small even for a deep pool.
  const avoid = (ctx.avoid ?? []).slice(0, 60);
  return [
    `You are an expert technical interviewer building a reusable question bank for a ${ctx.roleName}.`,
    `Generate exactly ${ctx.count} distinct, high-quality interview questions for this exact configuration.`,
    ``,
    `Configuration:`,
    `- Tech stack: ${ctx.techStack}`,
    `- Focus area: ${ctx.focusArea}`,
    `- Difficulty band: ${ctx.difficulty} (calibrate depth precisely — a Junior question must be noticeably easier than a Senior/Lead one).`,
    `- Interview type: ${ctx.interviewType}. ${typeInstruction(ctx.interviewType)}`,
    ``,
    `These are generic bank questions — do NOT reference any specific candidate, CV, or person.`,
    `Make the ${ctx.count} questions meaningfully different from each other (vary the sub-topic and angle).`,
    avoid.length
      ? `Do NOT repeat or lightly reword any of these existing questions:\n${avoid.map((q) => `- ${q}`).join("\n")}`
      : ``,
    ...(ctx.interviewType === "coding"
      ? codingFormat()
      : [idealAnswerSpec(ctx.difficulty)]),
    ``,
    ctx.interviewType === "coding"
      ? strict
        ? `CRITICAL: Respond with ONLY a raw JSON array. No markdown, no commentary. Each element must be an object with "question_text", "ideal_answer", and "language" string fields. The code inside ideal_answer may use newlines but the JSON itself must be valid (escape it properly).`
        : `Respond as a JSON array of objects with "question_text", "ideal_answer", and "language" string fields. No prose outside the JSON.`
      : strict
        ? `CRITICAL: Respond with ONLY a raw JSON array. No markdown, no code fences, no commentary. Each element must be an object with exactly "question_text" and "ideal_answer" string fields.`
        : `Respond as a JSON array of objects with "question_text" and "ideal_answer" string fields. No markdown.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generate question-bank entries for one exact config. Used by the offline
 * seed script and the admin "generate N more" action — NOT during interviews.
 * Shares the JSON/zod-validate + single strict retry behaviour of
 * {@link generateQuestions}. Throws QuestionGenerationError on failure.
 */
export async function generateQuestionBatch(
  ctx: BankGenContext,
): Promise<GeneratedQuestion[]> {
  const model = getModel({ json: true, temperature: 0.95, tier: "fast" });
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(buildBankPrompt(ctx, attempt === 2));
    } catch (error) {
      console.error("[groq:bank] request failed:", error);
      throw new QuestionGenerationError(
        "We couldn't generate bank questions right now. Please try again.",
      );
    }

    try {
      return questionsSchema.parse(parseModelJson(raw));
    } catch (error) {
      lastIssue = error;
      console.warn(
        `[groq:bank] invalid output on attempt ${attempt}, retrying...`,
      );
    }
  }

  console.error("[groq:bank] giving up after retries:", lastIssue);
  throw new QuestionGenerationError(
    "We couldn't generate bank questions right now. Please try again.",
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
};

/** What the model returns for a text answer (rubric + feedback, no total). */
const textScoreSchema = textRubricSchema.extend(feedbackFields);
/** What the model returns for a coding answer (rubric + feedback, no total). */
const codeScoreSchema = codeRubricSchema.extend(feedbackFields);

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
  rubric?: TextRubric;
  codeRubric?: CodeRubric;
}

/** Sum the four text-rubric components into a 0-10 total. */
function textTotal(r: TextRubric): number {
  return (
    r.technicalAccuracy +
    r.completeness +
    r.communicationClarity +
    r.interviewReadiness
  );
}

/** Weight the four code-rubric components into a 0-10 total. */
function codeTotal(r: CodeRubric): number {
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
    codeRubric,
  };
}

/**
 * The shared interviewer rubric + calibration block injected into every
 * text-answer scoring prompt (single and batch) so both paths grade
 * identically. Difficulty is woven in so the bar tracks the seniority band.
 */
function textRubricInstructions(difficulty: string): string[] {
  return [
    `Evaluate like a senior interviewer at a top engineering company. Be rigorous: reward genuine understanding, NOT keyword-matching. A short answer that merely names the right terms is not a strong answer.`,
    ``,
    `Grade with this STRUCTURED RUBRIC. The four components SUM to the /10 total — do not output a total yourself, just the four numbers:`,
    `- "technicalAccuracy" (0-4): Are the stated concepts correct and precise? Deduct for any factual mistake, vagueness, or imprecision.`,
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
}

function scorePrompt(ctx: ScoreContext, strict: boolean): string {
  return [
    `You are a fair but rigorous senior interviewer evaluating a candidate's answer for a ${ctx.roleName} role.`,
    ``,
    ...textRubricInstructions(ctx.difficulty),
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

function batchScorePrompt(
  roleName: string,
  difficulty: string,
  items: BatchScoreItem[],
  strict: boolean,
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
    ...textRubricInstructions(difficulty),
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
): Promise<Map<string, AnswerScore>> {
  if (items.length === 0) return new Map();

  const model = getModel({ json: true, temperature: 0.3, tier: "smart" });
  const requested = new Set(items.map((it) => it.id));
  // Accumulate valid per-id scores ACROSS attempts so a partial response (or a
  // second attempt that recovers some ids) is never discarded wholesale.
  const map = new Map<string, AnswerScore>();
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(
        batchScorePrompt(roleName, difficulty, items, attempt === 2),
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

function batchCodePrompt(
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
): Promise<Map<string, AnswerScore>> {
  if (items.length === 0) return new Map();

  const model = getModel({ json: true, temperature: 0.2, tier: "smart" });
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
}

/**
 * Generate a one-line overall summary. Never throws — returns a sensible
 * fallback sentence on any failure.
 */
export async function generateSummary(ctx: SummaryContext): Promise<string> {
  const fallback = `You scored ${ctx.totalScore}/${ctx.maxScore} on this ${ctx.difficulty} ${ctx.roleName} interview.`;
  try {
    const model = getModel({ json: false, temperature: 0.4, tier: "smart" });
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

/** Run a JSON-returning Groq prompt with the standard retry-strict loop. */
async function generateJson<T>(
  schema: z.ZodType<T>,
  buildPrompt: (strict: boolean) => string,
  opts: { temperature?: number; label: string },
): Promise<T> {
  const model = getModel({
    json: true,
    temperature: opts.temperature ?? 0.5,
    tier: "smart",
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
  fitScore: z.number().int().min(0).max(100),
  fitLevel: z.enum(["strong", "moderate", "weak"]),
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
): Promise<CvMatchAnalysis> {
  return generateJson(
    matchAnalysisSchema,
    (strict) =>
      [
        `You are an expert technical recruiter evaluating how well a candidate's CV matches a specific job.`,
        `Judge the SEMANTIC fit — transferable experience, seniority, domain, and responsibilities — not just literal keyword overlap. Be honest and specific; reference what the CV actually shows.`,
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
        `Use these only as hints — your fitScore should reflect real suitability, and may reasonably differ from the keyword score.`,
        ``,
        `Return a JSON object with:`,
        `- "fitScore": integer 0-100, your overall assessment of suitability for THIS role`,
        `- "fitLevel": one of "strong", "moderate", "weak"`,
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
    { temperature: 0.5, label: "cv-match" },
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
export async function optimizeCvForJob(ctx: OptimizeContext): Promise<CvData> {
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
        `- Keep it concise and professional.`,
        ``,
        `Return the FULL improved CV as a JSON object with exactly these keys: "contact" {name,title,email,phone,location,links[]}, "summary", "experience" [{title,company,period,link,description,bullets[]}], "projects" [{name,url,description}], "skills" [], "education" [{degree,institution,period,details}], "certifications" [{name,issuer,url}], "languages" []. Include every key even if its value is an empty array or string.`,
        strict
          ? `CRITICAL: Respond with ONLY the raw JSON object. No markdown, no code fences, no prose.`
          : `Respond as a JSON object only. No markdown.`,
      ]
        .filter(Boolean)
        .join("\n"),
    { temperature: 0.4, label: "cv-optimize" },
  );
}
