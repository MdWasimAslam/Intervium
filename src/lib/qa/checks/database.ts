import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@db";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §3 Database Health — real connectivity test. Runs `SELECT 1`, measures
 * round-trip latency, and counts public tables. No mock data: this is the live
 * database. (No AI; a plain SQL ping costs nothing.)
 */
export async function checkDatabase(): Promise<SectionOutput> {
  const checks: CheckResult[] = [];

  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    const latencyMs = Math.round(performance.now() - start);

    checks.push({
      id: "connection",
      label: "Database connection",
      status: "pass",
      detail: "Connected — SELECT 1 succeeded",
      latencyMs,
    });

    // Latency rating: fast < 150ms, acceptable < 500ms, otherwise a warning.
    const latencyStatus =
      latencyMs < 150 ? "pass" : latencyMs < 500 ? "warning" : "warning";
    checks.push({
      id: "latency",
      label: "Connection latency",
      status: latencyStatus,
      detail:
        latencyMs < 150
          ? "Healthy"
          : latencyMs < 500
            ? "Acceptable (consider region/pooling)"
            : "Slow — investigate network/pooling",
      latencyMs,
      recommendation:
        latencyStatus === "pass"
          ? undefined
          : "High DB latency can slow every request; verify the DB region and connection pooling.",
    });

    const tableCount = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname = 'public'`,
    );
    const count = Number(tableCount.rows[0]?.count ?? 0);
    checks.push({
      id: "tables",
      label: "Public tables",
      status: count > 0 ? "pass" : "fail",
      detail: `${count} table(s)`,
      recommendation:
        count > 0 ? undefined : "No tables found — run `npm run db:migrate`.",
    });
  } catch (error) {
    checks.push({
      id: "connection",
      label: "Database connection",
      status: "fail",
      detail: `Disconnected — ${error instanceof Error ? error.message : "unknown error"}`,
      latencyMs: Math.round(performance.now() - start),
      recommendation:
        "Verify DATABASE_URL and that the database is reachable (and SSL settings for remote hosts).",
    });
  }

  return { checks };
}
