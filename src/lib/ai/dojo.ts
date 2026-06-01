import { z } from "zod";
import { generateJson } from "./client";

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
        ctx.prompt
          ? `Base it on this idea: """${ctx.prompt.slice(0, 1500)}"""`
          : ``,
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
    {
      temperature: 0.6,
      label: "dojo-generate",
      feature: "dojo_generate",
      userId,
    },
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
