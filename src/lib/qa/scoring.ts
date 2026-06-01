/**
 * Health-scoring methodology for the QA Center — pure and deterministic.
 *
 * Each check yields a status; a section's status is the worst of its non-skip
 * checks. Sections carry a weight (summing to 100 across scored sections) and a
 * `critical` flag. The overall score is a weighted average where pass=1.0,
 * warning=0.6, fail=0.0; skipped sections drop out and the remaining weights are
 * re-normalised. Any failing critical section forces NOT READY regardless of the
 * number.
 */

import type {
  CheckResult,
  CheckStatus,
  DeploymentStatus,
  HealthSummary,
  OverviewItem,
  SectionId,
  SectionResult,
} from "./types";

/** Static metadata for every section (single source of truth). */
export interface SectionMeta {
  id: SectionId;
  title: string;
  /** Score weight; 0 means informational (unscored). */
  weight: number;
  /** A fail blocks deployment regardless of score. */
  critical: boolean;
}

/**
 * Weights sum to 100 across the scored sections. App-info and Errors are
 * informational (weight 0) — shown for context but never affect the score.
 */
export const SECTION_META: readonly SectionMeta[] = [
  { id: "app-info", title: "Application Information", weight: 0, critical: false },
  { id: "environment", title: "Environment Validation", weight: 15, critical: true },
  { id: "database", title: "Database Health", weight: 15, critical: true },
  { id: "db-structure", title: "Database Structure Audit", weight: 8, critical: false },
  { id: "integrations", title: "API Integration Health", weight: 8, critical: false },
  { id: "routes", title: "Application Route Audit", weight: 12, critical: true },
  { id: "components", title: "Component Health", weight: 6, critical: false },
  { id: "ats", title: "ATS Engine Validation", weight: 12, critical: true },
  { id: "interview", title: "Interview Engine Validation", weight: 12, critical: true },
  { id: "prompts", title: "Prompt Validation", weight: 4, critical: false },
  { id: "performance", title: "Performance Audit", weight: 4, critical: false },
  { id: "security", title: "Security Audit", weight: 4, critical: false },
  { id: "errors", title: "Error Log Analysis", weight: 0, critical: false },
];

export function sectionMeta(id: SectionId): SectionMeta {
  const meta = SECTION_META.find((m) => m.id === id);
  if (!meta) throw new Error(`Unknown QA section: ${id}`);
  return meta;
}

const STATUS_RANK: Record<CheckStatus, number> = {
  skip: 0,
  pass: 1,
  warning: 2,
  fail: 3,
};

/** The most severe status in a list, ignoring `skip`. Empty → `skip`. */
export function worstStatus(statuses: CheckStatus[]): CheckStatus {
  let worst: CheckStatus = "skip";
  for (const s of statuses) {
    if (STATUS_RANK[s] > STATUS_RANK[worst]) worst = s;
  }
  return worst;
}

/** A section's status is the worst of its non-skip checks. */
export function sectionStatus(checks: CheckResult[]): CheckStatus {
  return worstStatus(checks.map((c) => c.status).filter((s) => s !== "skip"));
}

const SCORE_FACTOR: Record<CheckStatus, number> = {
  pass: 1,
  warning: 0.6,
  fail: 0,
  skip: 0,
};

/** Weighted 0-100 score over scored, non-skipped sections (re-normalised). */
export function computeHealthScore(sections: SectionResult[]): number {
  const scored = sections.filter(
    (s) => !s.informational && s.weight > 0 && s.status !== "skip",
  );
  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 100;
  const earned = scored.reduce(
    (sum, s) => sum + s.weight * SCORE_FACTOR[s.status],
    0,
  );
  return Math.round((100 * earned) / totalWeight);
}

export function deploymentStatus(
  score: number,
  sections: SectionResult[],
): DeploymentStatus {
  const criticalFail = sections.some((s) => s.critical && s.status === "fail");
  if (criticalFail) return "NOT READY";
  if (score >= 90) return "READY FOR DEPLOYMENT";
  if (score >= 75) return "READY WITH WARNINGS";
  if (score >= 50) return "NEEDS ATTENTION";
  return "NOT READY";
}

export function summarize(sections: SectionResult[]): HealthSummary {
  const allChecks = sections.flatMap((s) => s.checks);
  const criticalIssues = sections
    .filter((s) => s.critical)
    .flatMap((s) => s.checks)
    .filter((c) => c.status === "fail").length;
  const score = computeHealthScore(sections);
  return {
    score,
    status: deploymentStatus(score, sections),
    criticalIssues,
    failures: allChecks.filter((c) => c.status === "fail").length,
    warnings: allChecks.filter((c) => c.status === "warning").length,
    recommendations: allChecks.filter((c) => Boolean(c.recommendation)).length,
  };
}

/** Worst status across a set of section ids (used for the overview chips). */
function rollup(sections: SectionResult[], ids: SectionId[]): CheckStatus {
  const present = sections.filter((s) => ids.includes(s.id));
  if (present.length === 0) return "skip";
  return worstStatus(present.map((s) => s.status));
}

/**
 * Top-of-dashboard status chips. "Build" is a static-integrity proxy (routes
 * resolve + components export), NOT a real `next build`.
 */
export function buildOverview(sections: SectionResult[]): OverviewItem[] {
  return [
    { label: "Build", status: rollup(sections, ["routes", "components"]) },
    { label: "Database", status: rollup(sections, ["database", "db-structure"]) },
    { label: "Routes", status: rollup(sections, ["routes"]) },
    { label: "ATS Engine", status: rollup(sections, ["ats"]) },
    { label: "Interview Engine", status: rollup(sections, ["interview"]) },
    { label: "Performance", status: rollup(sections, ["performance"]) },
    { label: "Security", status: rollup(sections, ["security"]) },
  ];
}
