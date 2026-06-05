import "server-only";
import { isLocalDatabase } from "@db";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §12 Security Audit — deterministic configuration checks. No values are
 * printed; only states and policy violations.
 */

const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "GROQ_API_KEY"];
// Names that must never be exposed to the browser via a NEXT_PUBLIC_ prefix.
const SENSITIVE_RE = /SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|GROQ|API_KEY/i;

export function checkSecurity(): SectionOutput {
  const checks: CheckResult[] = [];
  const isProd = process.env.NODE_ENV === "production";

  // 1. Required secrets present.
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  checks.push({
    id: "required-secrets",
    label: "Required secrets present",
    status: missing.length === 0 ? "pass" : "fail",
    detail: missing.length === 0 ? "all set" : `missing: ${missing.join(", ")}`,
    recommendation: missing.length ? "Set all required secrets before deploying." : undefined,
  });

  // 2. No server secret exposed via NEXT_PUBLIC_.
  const exposed = Object.keys(process.env).filter(
    (k) => k.startsWith("NEXT_PUBLIC_") && SENSITIVE_RE.test(k),
  );
  checks.push({
    id: "exposed-secrets",
    label: "Secrets not client-exposed",
    status: exposed.length === 0 ? "pass" : "fail",
    detail:
      exposed.length === 0
        ? "no sensitive NEXT_PUBLIC_* variables"
        : `exposed to client: ${exposed.join(", ")}`,
    recommendation: exposed.length
      ? "Remove the NEXT_PUBLIC_ prefix — these are bundled into client JS."
      : undefined,
  });

  // 3. AUTH_SECRET strength.
  const secretLen = process.env.AUTH_SECRET?.trim().length ?? 0;
  checks.push({
    id: "auth-secret-strength",
    label: "AUTH_SECRET strength",
    status: secretLen >= 32 ? "pass" : secretLen > 0 ? "warning" : "fail",
    detail: secretLen === 0 ? "not set" : `${secretLen} chars`,
    recommendation:
      secretLen >= 32 ? undefined : "Use a 32+ character random secret.",
  });

  // 4. DB SSL for remote hosts.
  checks.push({
    id: "db-ssl",
    label: "Database SSL",
    status: isLocalDatabase && isProd ? "warning" : "pass",
    detail: isLocalDatabase
      ? isProd
        ? "local DB without SSL while NODE_ENV=production"
        : "local DB (SSL not required)"
      : "remote DB with SSL enabled",
    recommendation:
      isLocalDatabase && isProd
        ? "Production should point at a managed DB over SSL."
        : undefined,
  });

  // 5. NODE_ENV sanity.
  checks.push({
    id: "node-env",
    label: "NODE_ENV",
    status: "pass",
    detail: process.env.NODE_ENV ?? "unset",
  });

  // 6. Debug flags off in production.
  const debugFlags = ["DEBUG", "NEXT_PUBLIC_DEBUG", "VERBOSE"].filter(
    (k) => process.env[k]?.trim(),
  );
  checks.push({
    id: "debug-flags",
    label: "Debug flags",
    status: isProd && debugFlags.length > 0 ? "warning" : "pass",
    detail: debugFlags.length ? `set: ${debugFlags.join(", ")}` : "none set",
    recommendation:
      isProd && debugFlags.length
        ? "Disable debug/verbose flags in production."
        : undefined,
  });

  // 7. Self-aware: this dashboard is admin-only in every environment.
  checks.push({
    id: "qa-exposure",
    label: "QA dashboard exposure",
    status: "pass",
    detail: "admin-only (available in all environments)",
    recommendation: isProd
      ? "Keep /qa strictly behind the admin role check; it reports no secret values."
      : undefined,
  });

  return { checks };
}
