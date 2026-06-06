import "server-only";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §2 Environment Validation — presence/non-empty only. Secret VALUES are never
 * read into the report, only their state (set / empty / missing).
 *
 * The required list mirrors REQUIRED_ENV in src/lib/env.ts; the optional list is
 * what the codebase actually references (Groq tuning, public site URL, budgets,
 * and the demo-account / email vars).
 */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "GROQ_API_KEY"] as const;

const OPTIONAL: { key: string; note: string }[] = [
  { key: "NEXT_PUBLIC_SITE_URL", note: "Falls back to http://localhost:3000." },
  { key: "GROQ_FAST_MODEL", note: "Defaults to llama-3.1-8b-instant." },
  { key: "GROQ_SMART_MODEL", note: "Defaults to llama-3.3-70b-versatile." },
  { key: "AI_DAILY_BUDGET", note: "Defaults to the built-in daily cap." },
  // Demo showcase account (all optional — the demo feature is simply off when
  // unset). DEMO_USER_EMAIL is what arms the AI/delete locks at runtime.
  {
    key: "DEMO_USER_EMAIL",
    note: "Unset → no demo account; the AI/delete locks and demo banner are inactive.",
  },
  {
    key: "DEMO_ACCESS_KEY",
    note: "Demo account password shared by the seed and the invite email; defaults to a built-in fallback.",
  },
  {
    key: "RESEND_API_KEY",
    note: "Needed to send demo-invite emails; without it the demo-access request returns a config error.",
  },
  {
    key: "DEMO_INVITE_FROM",
    note: "Verified sender for demo invites; falls back to Resend's test sender (dev-only delivery).",
  },
  {
    key: "NEXT_PUBLIC_GITHUB_REPO_URL",
    note: "Star-CTA target on the demo access form; falls back to the project repo URL.",
  },
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
    // An unset optional var is fine: it uses the documented default, which we
    // treat as the intended configuration (PASS). Only a SET-but-EMPTY value is
    // a likely misconfiguration, so that's the one case that still warns.
    const status = state === "empty" ? "warning" : "pass";
    checks.push({
      id: `opt-${key}`,
      label: key,
      status,
      detail: state === "set" ? "set" : `${state} (using default)`,
      // Nudge only when something looks wrong (explicitly empty), never when a
      // default is intentionally in use.
      recommendation: state === "empty" ? note : undefined,
    });
  }

  return { checks };
}
