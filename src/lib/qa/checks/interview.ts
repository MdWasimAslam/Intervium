import "server-only";
import { codeTotal, textTotal } from "@/lib/groq";
import {
  AGGREGATION_FIXTURE,
  CODE_RUBRIC_FIXTURES,
  TEXT_RUBRIC_FIXTURES,
} from "../fixtures";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §9 Interview Engine Validation. Exercises the REAL deterministic scoring math
 * — `textTotal` (sum of the four rubric components → 0-10) and `codeTotal`
 * (weighted 0.4/0.25/0.2/0.15) — plus session-total aggregation, all with mock
 * rubrics. No AI: the model only produces the rubric numbers, which are fixed
 * here, so the grading/result math is fully testable offline.
 */
export function checkInterview(): SectionOutput {
  const checks: CheckResult[] = [];

  for (const fx of TEXT_RUBRIC_FIXTURES) {
    const actual = textTotal(fx.rubric);
    const ok = actual === fx.expectedTotal;
    checks.push({
      id: fx.id,
      label: `Text scoring · ${fx.label}`,
      status: ok ? "pass" : "fail",
      detail: `score ${actual}/10`,
      expected: String(fx.expectedTotal),
      actual: String(actual),
      recommendation: ok ? undefined : "Text rubric total drifted — review groq.ts `textTotal`.",
    });
  }

  for (const fx of CODE_RUBRIC_FIXTURES) {
    const actual = codeTotal(fx.rubric);
    const ok = actual === fx.expectedTotal;
    checks.push({
      id: fx.id,
      label: `Code scoring · ${fx.label}`,
      status: ok ? "pass" : "fail",
      detail: `score ${actual}/10`,
      expected: String(fx.expectedTotal),
      actual: String(actual),
      recommendation: ok ? undefined : "Code rubric total drifted — review groq.ts `codeTotal`.",
    });
  }

  // Session-total aggregation (mirrors src/lib/scoring.ts: sum of per-question).
  const total = AGGREGATION_FIXTURE.perQuestion.reduce((s, q) => s + q.score, 0);
  const max = AGGREGATION_FIXTURE.perQuestion.reduce((s, q) => s + q.maxScore, 0);
  const aggOk =
    total === AGGREGATION_FIXTURE.expectedTotal &&
    max === AGGREGATION_FIXTURE.expectedMax;
  checks.push({
    id: "aggregation",
    label: "Session total aggregation",
    status: aggOk ? "pass" : "fail",
    detail: `${total}/${max} from ${AGGREGATION_FIXTURE.perQuestion.length} questions`,
    expected: `${AGGREGATION_FIXTURE.expectedTotal}/${AGGREGATION_FIXTURE.expectedMax}`,
    actual: `${total}/${max}`,
    recommendation: aggOk ? undefined : "Aggregation drifted — review src/lib/scoring.ts.",
  });

  return { checks };
}
