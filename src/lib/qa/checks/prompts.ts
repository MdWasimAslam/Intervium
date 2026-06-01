import "server-only";
import {
  batchCodePrompt,
  batchScorePrompt,
  buildPrompt,
  scorePrompt,
  type GenerationContext,
  type ScoreContext,
} from "@/lib/groq";
import type { CheckResult, SectionOutput } from "../types";
import { readProjectFile } from "./shared";

/**
 * §10 Prompt Validation — deterministic, no AI.
 *
 * (a) Template files: present, non-empty, contain the required placeholders,
 *     and have balanced braces/brackets.
 * (b) Code builders: rendered with sentinel context and checked for full
 *     substitution (sentinels present, no leftover "undefined"/"[object Object]"
 *     and no unresolved "${" template artifacts).
 */

const REQUIRED_TOKENS = [
  "questionText",
  "idealAnswer",
  "techStack",
  "focusArea",
  "difficulty",
  "interviewType",
  "JSON",
];

function balanced(text: string, open: string, close: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === open) depth++;
    else if (ch === close) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function validateTemplateFile(relPath: string): CheckResult {
  const raw = readProjectFile(relPath);
  if (raw === null) {
    return {
      id: `file-${relPath}`,
      label: relPath,
      status: "skip",
      detail: "Not readable in this environment",
    };
  }
  if (raw.trim().length === 0) {
    return {
      id: `file-${relPath}`,
      label: relPath,
      status: "fail",
      detail: "File is empty",
      recommendation: `Restore the prompt template in ${relPath}.`,
    };
  }
  const missing = REQUIRED_TOKENS.filter((t) => !raw.includes(t));
  const bracesOk = balanced(raw, "{", "}") && balanced(raw, "[", "]");
  const status = missing.length > 0 || !bracesOk ? "warning" : "pass";
  const issues: string[] = [];
  if (missing.length) issues.push(`missing tokens: ${missing.join(", ")}`);
  if (!bracesOk) issues.push("unbalanced braces/brackets");
  return {
    id: `file-${relPath}`,
    label: relPath,
    status,
    detail: issues.length ? issues.join("; ") : "structure OK",
    recommendation: issues.length
      ? `Review the prompt template in ${relPath}.`
      : undefined,
  };
}

/** Assert a rendered prompt is fully substituted and contains its sentinels. */
function validateRendered(
  id: string,
  label: string,
  rendered: string,
  sentinels: string[],
): CheckResult {
  const problems: string[] = [];
  if (rendered.trim().length === 0) problems.push("empty output");
  // NB: we don't flag the literal word "undefined" — it appears legitimately in
  // the calibration prose ("initialized with undefined", "null/undefined").
  // A dropped variable is caught instead by its sentinel going missing below.
  if (rendered.includes("[object Object]")) problems.push('contains "[object Object]"');
  if (rendered.includes("${")) problems.push("unresolved ${} template");
  const absent = sentinels.filter((s) => !rendered.includes(s));
  if (absent.length) problems.push(`sentinel not substituted: ${absent.join(", ")}`);
  return {
    id,
    label,
    status: problems.length ? "fail" : "pass",
    detail: problems.length ? problems.join("; ") : "renders & substitutes cleanly",
    recommendation: problems.length
      ? "Prompt builder dropped or failed to substitute a variable."
      : undefined,
  };
}

export function checkPrompts(): SectionOutput {
  const checks: CheckResult[] = [
    validateTemplateFile("prompt.md"),
    validateTemplateFile("db/question-prompt.md"),
  ];

  const genCtx: GenerationContext = {
    roleName: "SENTINEL_ROLE",
    techStack: "SENTINEL_STACK",
    skillLevel: "advanced",
    count: 5,
    yearsExperience: 3,
    skills: ["SENTINEL_SKILL"],
    targetRole: "SENTINEL_TARGET",
    cvText: "SENTINEL_CV",
    professionType: "technical",
  };
  checks.push(
    validateRendered(
      "builder-generation",
      "Question generation prompt",
      buildPrompt(genCtx, true),
      ["SENTINEL_ROLE", "SENTINEL_STACK", "SENTINEL_SKILL"],
    ),
  );

  const scoreCtx: ScoreContext = {
    roleName: "SENTINEL_ROLE",
    difficulty: "Senior",
    question: "SENTINEL_Q",
    idealAnswer: "SENTINEL_IDEAL",
    userAnswer: "SENTINEL_ANSWER",
    professionType: "technical",
  };
  checks.push(
    validateRendered(
      "builder-evaluation",
      "Answer evaluation prompt",
      scorePrompt(scoreCtx, true),
      ["SENTINEL_ROLE", "SENTINEL_Q", "SENTINEL_IDEAL", "SENTINEL_ANSWER"],
    ),
  );

  checks.push(
    validateRendered(
      "builder-batch-text",
      "Batch text-scoring prompt",
      batchScorePrompt(
        "SENTINEL_ROLE",
        "Senior",
        [
          {
            id: "SENTINEL_ID",
            question: "SENTINEL_Q",
            idealAnswer: "SENTINEL_IDEAL",
            userAnswer: "SENTINEL_ANSWER",
          },
        ],
        true,
        "technical",
      ),
      ["SENTINEL_ROLE", "SENTINEL_ID", "SENTINEL_Q"],
    ),
  );

  checks.push(
    validateRendered(
      "builder-batch-code",
      "Code-scoring prompt",
      batchCodePrompt(
        "SENTINEL_ROLE",
        "Senior",
        [
          {
            id: "SENTINEL_ID",
            question: "SENTINEL_Q",
            idealSolution: "SENTINEL_SOLUTION",
            userCode: "SENTINEL_CODE",
            language: "javascript",
          },
        ],
        true,
      ),
      ["SENTINEL_ROLE", "SENTINEL_ID", "SENTINEL_SOLUTION", "SENTINEL_CODE"],
    ),
  );

  return { checks };
}
