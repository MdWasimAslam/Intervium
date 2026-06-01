import "server-only";
import { analyzeMatch, fitLevelFromScore } from "@/lib/cv/ats";
import { ATS_FIXTURES } from "../fixtures";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §8 ATS Engine Validation. Runs the REAL deterministic matcher
 * (`analyzeMatch` + `fitLevelFromScore`) over fixed resume/JD fixtures and
 * asserts the score lands in the expected band. Zero AI — pure keyword math.
 */
export function checkAts(): SectionOutput {
  const checks: CheckResult[] = ATS_FIXTURES.map((fx) => {
    const [min, max] = fx.expected;
    const { score, matched, missing } = analyzeMatch(fx.cv, fx.jd);
    const fit = fitLevelFromScore(score);
    const inBand = score >= min && score <= max;
    return {
      id: fx.id,
      label: fx.label,
      status: inBand ? "pass" : "fail",
      detail: `${score}/100 (${fit.label}) · matched ${matched.length}, missing ${missing.length}`,
      expected: `${min}–${max}`,
      actual: String(score),
      recommendation: inBand
        ? undefined
        : "ATS scoring drifted from its expected range — review src/lib/cv/ats.ts.",
    };
  });

  return { checks };
}
