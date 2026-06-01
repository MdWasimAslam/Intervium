import "server-only";
import { isLocalDatabase } from "@db";
import type { CheckResult, RunContext, SectionOutput } from "../types";

/**
 * §5 API Integration Health. Validates configuration for every real integration
 * (Groq, NextAuth, Postgres). When liveProbe is on it also makes ONE token-free
 * GET to Groq's /models endpoint to measure latency — no LLM call, no tokens.
 */

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const PROBE_TIMEOUT_MS = 8_000;

async function timedFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; latencyMs: number } | { error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkIntegrations(ctx: RunContext): Promise<SectionOutput> {
  const checks: CheckResult[] = [];

  // --- Groq (AI provider) ---------------------------------------------------
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) {
    checks.push({
      id: "groq-config",
      label: "Groq · configuration",
      status: "fail",
      detail: "GROQ_API_KEY missing — AI features will not work",
      recommendation: "Set GROQ_API_KEY.",
    });
  } else {
    checks.push({
      id: "groq-config",
      label: "Groq · configuration",
      status: "pass",
      detail: `key set · fast=${process.env.GROQ_FAST_MODEL?.trim() || "llama-3.1-8b-instant"}, smart=${process.env.GROQ_SMART_MODEL?.trim() || "llama-3.3-70b-versatile"}`,
    });

    if (ctx.liveProbe) {
      const result = await timedFetch(GROQ_MODELS_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${groqKey}` },
      });
      if ("error" in result) {
        checks.push({
          id: "groq-ping",
          label: "Groq · connectivity",
          status: "warning",
          detail: `Probe failed: ${result.error}`,
          recommendation: "Network issue or Groq unreachable; AI calls may fail.",
        });
      } else if (result.status === 401 || result.status === 403) {
        checks.push({
          id: "groq-ping",
          label: "Groq · connectivity",
          status: "fail",
          detail: `Auth rejected (HTTP ${result.status}) — key is invalid`,
          latencyMs: result.latencyMs,
          recommendation: "Rotate/replace GROQ_API_KEY.",
        });
      } else {
        checks.push({
          id: "groq-ping",
          label: "Groq · connectivity",
          status: result.ok ? "pass" : "warning",
          detail: result.ok
            ? "Reachable (token-free /models)"
            : `Unexpected HTTP ${result.status}`,
          latencyMs: result.latencyMs,
        });
      }
    } else {
      checks.push({
        id: "groq-ping",
        label: "Groq · connectivity",
        status: "skip",
        detail: "Live probe off — enable 'Live probes' to measure latency",
      });
    }
  }

  // --- NextAuth (authentication) -------------------------------------------
  const authSecret = process.env.AUTH_SECRET?.trim() ?? "";
  checks.push({
    id: "auth-config",
    label: "NextAuth · configuration",
    status: !authSecret ? "fail" : authSecret.length >= 32 ? "pass" : "warning",
    detail: !authSecret
      ? "AUTH_SECRET missing"
      : authSecret.length >= 32
        ? `secret set (${authSecret.length} chars)`
        : `secret set but short (${authSecret.length} chars)`,
    recommendation: !authSecret
      ? "Set AUTH_SECRET."
      : authSecret.length >= 32
        ? undefined
        : "Use a 32+ character random AUTH_SECRET in production.",
  });

  // --- Postgres (config view; live ping is §3) ------------------------------
  const hasDbUrl = Boolean(process.env.DATABASE_URL?.trim());
  checks.push({
    id: "postgres-config",
    label: "Postgres · configuration",
    status: hasDbUrl ? "pass" : "fail",
    detail: hasDbUrl
      ? `DATABASE_URL set · SSL ${isLocalDatabase ? "off (local)" : "on (remote)"}`
      : "DATABASE_URL missing",
    recommendation: hasDbUrl ? undefined : "Set DATABASE_URL.",
  });

  return { checks };
}
