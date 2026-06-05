import "server-only";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §2 Environment Validation — presence/non-empty only. Secret VALUES are never
 * read into the report, only their state (set / empty / missing).
 *
 * The required list mirrors REQUIRED_ENV in src/lib/env.ts; the optional list is
 * what the codebase actually references (Groq tuning, public site URL, budgets).
 */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "GROQ_API_KEY"] as const;

const OPTIONAL: { key: string; note: string }[] = [
  { key: "NEXT_PUBLIC_SITE_URL", note: "Falls back to http://localhost:3000." },
  { key: "GROQ_FAST_MODEL", note: "Defaults to llama-3.1-8b-instant." },
  { key: "GROQ_SMART_MODEL", note: "Defaults to llama-3.3-70b-versatile." },
  { key: "AI_DAILY_BUDGET", note: "Defaults to the built-in daily cap." },
];

type State = "set" | "empty" | "missing";

function stateOf(key: string): State {
  const value = process.env[key];
  if (value === undefined) return "missing";
  if (value.trim() === "") return "empty";
  return "set";
}

export function checkEnv(): SectionOutput {
  const checks: CheckResult[] = [];

  for (const key of REQUIRED) {
    const state = stateOf(key);
    checks.push({
      id: `req-${key}`,
      label: key,
      status: state === "set" ? "pass" : "fail",
      detail: state === "set" ? "set" : state,
      recommendation:
        state === "set"
          ? undefined
          : `Required variable is ${state}. Set ${key} before deploying.`,
    });
  }

  for (const { key, note } of OPTIONAL) {
    const state = stateOf(key);
    // "empty" on an optional var is suspicious; "missing" just falls back.
    const status = state === "set" ? "pass" : state === "empty" ? "warning" : "warning";
    checks.push({
      id: `opt-${key}`,
      label: key,
      status,
      detail: state === "set" ? "set" : `${state} (using default)`,
      recommendation: state === "set" ? undefined : note,
    });
  }

  return { checks };
}
