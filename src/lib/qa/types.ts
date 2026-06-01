/**
 * Shared types for the Production QA Center (`/qa`).
 *
 * This module is intentionally dependency-free and CLIENT-SAFE: both the
 * server-side check engine and the client dashboard import it. It must never
 * pull in `db`, `groq`, `fs`, or anything `server-only`.
 */

/** Outcome of a single deterministic check. */
export type CheckStatus = "pass" | "warning" | "fail" | "skip";

/** One assertion within a section (e.g. "GROQ_API_KEY is set"). */
export interface CheckResult {
  /** Stable id, unique within its section. */
  id: string;
  label: string;
  status: CheckStatus;
  /** Human-readable observation / value (never a secret value). */
  detail?: string;
  /** Engine tests: what we expected. */
  expected?: string;
  /** Engine tests: what we actually got. */
  actual?: string;
  /** Measured latency in milliseconds, when relevant. */
  latencyMs?: number;
  /** Remediation hint surfaced in the report. */
  recommendation?: string;
}

/** Stable ids for every section the engine can run. */
export type SectionId =
  | "app-info"
  | "environment"
  | "database"
  | "db-structure"
  | "integrations"
  | "routes"
  | "components"
  | "ats"
  | "interview"
  | "prompts"
  | "performance"
  | "security"
  | "errors";

/** Options threaded into every check module. */
export interface RunContext {
  /** When true, checks may make token-free network calls (DB ping, Groq /models). */
  liveProbe: boolean;
  /** Base URL for live route probing (e.g. http://localhost:3000). */
  baseUrl?: string;
}

/** What a check module returns; run.ts wraps it with metadata + status. */
export interface SectionOutput {
  checks: CheckResult[];
  /** Free-form caveat shown under the section (e.g. a known limitation). */
  note?: string;
}

/** A section's check function. */
export type CheckModule = (
  ctx: RunContext,
) => Promise<SectionOutput> | SectionOutput;

/** A fully-resolved section in the report. */
export interface SectionResult extends SectionOutput {
  id: SectionId;
  title: string;
  status: CheckStatus;
  /** Weight toward the 0-100 health score (0 = informational). */
  weight: number;
  /** A fail here forces NOT READY regardless of score. */
  critical: boolean;
  /** Excluded from the score (shown for context only). */
  informational: boolean;
  /** Wall-clock time to run the section, ms. */
  durationMs: number;
}

export type DeploymentStatus =
  | "READY FOR DEPLOYMENT"
  | "READY WITH WARNINGS"
  | "NEEDS ATTENTION"
  | "NOT READY";

/** Rolled-up numbers for the dashboard header and exports. */
export interface HealthSummary {
  /** 0-100 weighted health score. */
  score: number;
  status: DeploymentStatus;
  /** Failing checks inside critical sections. */
  criticalIssues: number;
  /** Total failing checks. */
  failures: number;
  /** Total warning checks. */
  warnings: number;
  /** Total checks carrying a remediation hint. */
  recommendations: number;
}

/** A top-of-dashboard status chip (Build / Database / Routes / …). */
export interface OverviewItem {
  label: string;
  status: CheckStatus;
}

/** The complete QA report — the value returned by `POST /api/qa/run`. */
export interface QaReport {
  /** ISO timestamp the report was generated. */
  generatedAt: string;
  appVersion: string;
  commit: string;
  environment: string;
  /** Whether network probes were performed (DB ping always runs). */
  liveProbe: boolean;
  /** Total wall-clock time for the run, ms. */
  durationMs: number;
  summary: HealthSummary;
  overview: OverviewItem[];
  sections: SectionResult[];
}
