import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@db";
import type { CheckResult, SectionOutput } from "../types";
import { readJsonSafe } from "./shared";

/**
 * §4 Database Structure Audit. Cross-checks the live `public` schema against the
 * tables defined in db/schema.ts and reports migration drift. Critical tables
 * (the interview/CV/auth core) failing → FAIL; others → WARNING.
 */

/** Every table db/schema.ts defines. */
const EXPECTED_TABLES = [
  "users",
  "access_codes",
  "job_roles",
  "tech_stacks",
  "profiles",
  "bank_questions",
  "interview_sessions",
  "session_questions",
  "app_settings",
  "ai_usage",
  "ai_usage_log",
  "cv_versions",
  "cover_letters",
  "dojo_questions",
  "dojo_topics",
  "dojo_question_topics",
  "dojo_attempts",
  "dojo_progress",
  "study_folders",
  "study_notes",
] as const;

/** A missing one of these means the app cannot function. */
const CRITICAL_TABLES = new Set<string>([
  "users",
  "profiles",
  "job_roles",
  "tech_stacks",
  "bank_questions",
  "interview_sessions",
  "session_questions",
  "app_settings",
]);

export async function checkDbStructure(): Promise<SectionOutput> {
  const checks: CheckResult[] = [];

  let present: Set<string>;
  try {
    const res = await db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    present = new Set(res.rows.map((r) => r.tablename));
  } catch (error) {
    return {
      checks: [
        {
          id: "structure",
          label: "Table introspection",
          status: "fail",
          detail: `Could not read pg_tables — ${error instanceof Error ? error.message : "unknown error"}`,
        },
      ],
    };
  }

  const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
  const missingCritical = missing.filter((t) => CRITICAL_TABLES.has(t));

  checks.push({
    id: "expected-tables",
    label: "Expected tables present",
    status: missingCritical.length > 0 ? "fail" : missing.length > 0 ? "warning" : "pass",
    detail:
      missing.length === 0
        ? `All ${EXPECTED_TABLES.length} expected tables present`
        : `Missing: ${missing.join(", ")}`,
    expected: `${EXPECTED_TABLES.length} tables`,
    actual: `${EXPECTED_TABLES.length - missing.length} present`,
    recommendation:
      missing.length === 0
        ? undefined
        : "Run `npm run db:migrate` to apply pending migrations.",
  });

  // Migration drift: journal entries vs. applied rows.
  const journal = readJsonSafe<{ entries?: unknown[] }>(
    "drizzle/meta/_journal.json",
  );
  const journalCount = journal?.entries?.length ?? null;

  let appliedCount: number | null = null;
  try {
    const res = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations`,
    );
    appliedCount = Number(res.rows[0]?.count ?? 0);
  } catch {
    appliedCount = null;
  }

  if (journalCount === null) {
    checks.push({
      id: "migrations",
      label: "Migration status",
      status: "skip",
      detail: "drizzle/meta/_journal.json not readable in this environment",
    });
  } else if (appliedCount === null) {
    checks.push({
      id: "migrations",
      label: "Migration status",
      status: "warning",
      detail: `${journalCount} migration(s) in journal; applied count unavailable (drizzle.__drizzle_migrations not found)`,
      recommendation:
        "If this is a fresh database, run `npm run db:migrate`.",
    });
  } else {
    const drift = journalCount - appliedCount;
    checks.push({
      id: "migrations",
      label: "Migration status",
      status: drift <= 0 ? "pass" : "warning",
      detail:
        drift <= 0
          ? `Up to date (${appliedCount}/${journalCount} applied)`
          : `${drift} migration(s) not applied (${appliedCount}/${journalCount})`,
      expected: `${journalCount} applied`,
      actual: `${appliedCount} applied`,
      recommendation: drift > 0 ? "Run `npm run db:migrate`." : undefined,
    });
  }

  return { checks };
}
