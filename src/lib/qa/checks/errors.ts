import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@db";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §13 Error Log Analysis. The app has no general frontend/exception store, so
 * this is best-effort and informational. What IS persisted: the AI usage log,
 * whose non-"success" rows are a real backend error signal — we surface those.
 */
export async function checkErrors(): Promise<SectionOutput> {
  const checks: CheckResult[] = [];

  try {
    const res = await db.execute<{ status: string; count: number }>(
      sql`SELECT status, COUNT(*)::int AS count
          FROM ai_usage_log
          WHERE created_at > now() - interval '7 days'
          GROUP BY status`,
    );
    const rows = res.rows;
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    const errors = rows
      .filter((r) => r.status !== "success")
      .reduce((s, r) => s + Number(r.count), 0);
    const rate = total > 0 ? errors / total : 0;

    checks.push({
      id: "ai-errors",
      label: "AI call errors (7 days)",
      status: errors === 0 ? "pass" : rate > 0.2 ? "fail" : "warning",
      detail:
        total === 0
          ? "No AI calls logged in the last 7 days"
          : `${errors}/${total} failed (${Math.round(rate * 100)}%)`,
      recommendation:
        errors === 0
          ? undefined
          : "Investigate failing AI calls (quota/keys/model) in Admin → AI Usage.",
    });
  } catch {
    checks.push({
      id: "ai-errors",
      label: "AI call errors (7 days)",
      status: "skip",
      detail: "ai_usage_log not available",
    });
  }

  checks.push({
    id: "frontend-errors",
    label: "Frontend / console errors",
    status: "skip",
    detail: "No client error-reporting backend is configured",
    recommendation:
      "Add an error reporter (e.g. Sentry) to capture frontend exceptions in production.",
  });

  return {
    note: "Informational — no general exception store exists; only persisted AI-call failures are analysed.",
    checks,
  };
}
