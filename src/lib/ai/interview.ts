import { z } from "zod";
import { getAiProvider, resolveFeatureModel } from "@/lib/settings";
import {
  getModel,
  parseModelJson,
  QuestionGenerationError,
  type AiProvider,
} from "./client";

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

/**
 * Generate questions via Groq. Retries once with a stricter instruction if
 * the output fails JSON/zod validation. Throws QuestionGenerationError on
 * network/quota errors or repeated invalid output.
 */
export async function generateQuestions(
  ctx: GenerationContext,
): Promise<GeneratedQuestion[]> {
  const { provider, model: modelId } = await resolveFeatureModel(
    "question_gen",
    { fallbackProvider: "groq" },
  );
  const model = getModel({
    tier: "fast",
    provider,
    model: modelId,
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
  const model = getModel({
    json: true,
    temperature: 0.3,
    tier: "smart",
    provider: await getAiProvider(),
  });
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

  const { provider: resolvedProvider, model: modelId } =
    await resolveFeatureModel("scoring_text", { fallbackProvider: provider });
  const model = getModel({
    json: true,
    temperature: 0.3,
    tier: "smart",
    provider: resolvedProvider,
    model: modelId,
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

  const { provider: resolvedProvider, model: modelId } =
    await resolveFeatureModel("scoring_code", { fallbackProvider: provider });
  const model = getModel({
    json: true,
    temperature: 0.2,
    tier: "smart",
    provider: resolvedProvider,
    model: modelId,
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
    const { provider, model: modelId } =
      await resolveFeatureModel("summary_gen");
    const model = getModel({
      json: false,
      temperature: 0.4,
      tier: "smart",
      provider,
      model: modelId,
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
