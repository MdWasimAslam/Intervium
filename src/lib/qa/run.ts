import "server-only";
import type {
  CheckModule,
  QaReport,
  RunContext,
  SectionId,
  SectionOutput,
  SectionResult,
} from "./types";
import {
  SECTION_META,
  buildOverview,
  sectionStatus,
  summarize,
} from "./scoring";
import { appVersion, gitCommit, nodeEnv } from "./checks/shared";
import { checkAppInfo } from "./checks/app-info";
import { checkEnv } from "./checks/env";
import { checkDatabase } from "./checks/database";
import { checkDbStructure } from "./checks/db-structure";
import { checkIntegrations } from "./checks/integrations";
import { checkRoutes } from "./checks/routes";
import { checkComponents } from "./checks/components";
import { checkAts } from "./checks/ats";
import { checkInterview } from "./checks/interview";
import { checkPrompts } from "./checks/prompts";
import { checkPerformance } from "./checks/performance";
import { checkSecurity } from "./checks/security";
import { checkErrors } from "./checks/errors";

/** Maps each section id to its check function (uniform CheckModule signature). */
const REGISTRY: Record<SectionId, CheckModule> = {
  "app-info": () => checkAppInfo(),
  environment: () => checkEnv(),
  database: () => checkDatabase(),
  "db-structure": () => checkDbStructure(),
  integrations: (ctx) => checkIntegrations(ctx),
  routes: (ctx) => checkRoutes(ctx),
  components: () => checkComponents(),
  ats: () => checkAts(),
  interview: () => checkInterview(),
  prompts: () => checkPrompts(),
  performance: () => checkPerformance(),
  security: () => checkSecurity(),
  errors: () => checkErrors(),
};

export interface RunAuditOptions {
  /** Subset of sections to run; defaults to all (in canonical order). */
  sections?: SectionId[];
  /** Allow token-free network probes (Groq /models, live route GETs). */
  liveProbe?: boolean;
  /** Base URL for live route probing. */
  baseUrl?: string;
}

const VALID_IDS = new Set<SectionId>(SECTION_META.map((m) => m.id));

/**
 * Run the requested QA sections and assemble a report. A check that throws is
 * captured as a single failing result rather than aborting the whole audit, so
 * one bad section never blanks the dashboard.
 *
 * For a partial run, summary/overview are computed over the returned sections
 * only; the client merges and recomputes against its full report.
 */
export async function runAudit(opts: RunAuditOptions = {}): Promise<QaReport> {
  const liveProbe = opts.liveProbe ?? false;
  const ctx: RunContext = { liveProbe, baseUrl: opts.baseUrl };

  const requested =
    opts.sections && opts.sections.length
      ? new Set(opts.sections.filter((id) => VALID_IDS.has(id)))
      : VALID_IDS;

  const runStart = performance.now();
  const sections: SectionResult[] = [];

  for (const meta of SECTION_META) {
    if (!requested.has(meta.id)) continue;
    const start = performance.now();
    let output: SectionOutput;
    try {
      output = await REGISTRY[meta.id](ctx);
    } catch (error) {
      output = {
        checks: [
          {
            id: "section-error",
            label: meta.title,
            status: "fail",
            detail: error instanceof Error ? error.message : "check threw",
            recommendation: "This section errored — see server logs.",
          },
        ],
      };
    }
    sections.push({
      ...output,
      id: meta.id,
      title: meta.title,
      weight: meta.weight,
      critical: meta.critical,
      informational: meta.weight === 0,
      status: sectionStatus(output.checks),
      durationMs: Math.round(performance.now() - start),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    appVersion: appVersion(),
    commit: gitCommit(),
    environment: nodeEnv(),
    liveProbe,
    durationMs: Math.round(performance.now() - runStart),
    summary: summarize(sections),
    overview: buildOverview(sections),
    sections,
  };
}
