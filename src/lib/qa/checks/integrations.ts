import "server-only";
import { isLocalDatabase } from "@db";
import { MODEL_CATALOG } from "@/lib/ai/catalog";
import { getModel } from "@/lib/ai/client";
import type { AiProvider } from "@/lib/ai/client";
import type { CheckResult, RunContext, SectionOutput } from "../types";

/**
 * §5 API Integration Health. Validates configuration for every real integration
 * (Groq, DeepSeek, NextAuth, Postgres). When liveProbe is on it also:
 *   - makes ONE token-free GET to Groq's /models endpoint (latency/auth), and
 *   - sends a tiny prompt to EACH catalog model to confirm it actually answers
 *     (this one spends a few tokens — hence it's gated behind live probe).
 */

/** Env var holding each provider's API key. */
const PROVIDER_KEY_ENV: Record<AiProvider, string> = {
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

/**
 * Actually invoke one model with a minimal prompt and confirm a non-empty
 * reply. Returns a skip when the provider's key isn't set (so an unconfigured
 * optional provider like DeepSeek doesn't read as a failure).
 */
async function probeModel(
  provider: AiProvider,
  model: string,
): Promise<CheckResult> {
  const id = `model-${provider}-${model}`;
  const label = `Model · ${provider}/${model}`;

  if (!process.env[PROVIDER_KEY_ENV[provider]]?.trim()) {
    return {
      id,
      label,
      status: "skip",
      detail: `${PROVIDER_KEY_ENV[provider]} not set — provider not configured`,
    };
  }

  const start = performance.now();
  try {
    const text = await getModel({
      json: false,
      temperature: 0,
      provider,
      model,
    }).generateContent("Reply with the single word OK and nothing else.");
    const latencyMs = Math.round(performance.now() - start);
    const reply = text.trim();
    return {
      id,
      label,
      status: reply.length > 0 ? "pass" : "warning",
      detail:
        reply.length > 0
          ? `Responded: "${reply.slice(0, 40)}"`
          : "Empty response from model",
      latencyMs,
      recommendation:
        reply.length > 0 ? undefined : "Model reachable but returned nothing.",
    };
  } catch (error) {
    return {
      id,
      label,
      status: "fail",
      detail: error instanceof Error ? error.message : "Model call failed",
      latencyMs: Math.round(performance.now() - start),
      recommendation: `Check the ${provider} key/model id and provider status.`,
    };
  }
}

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const PROBE_TIMEOUT_MS = 8_000;

async function timedFetch(
  url: string,
  init: RequestInit,
): Promise<
  { ok: boolean; status: number; latencyMs: number } | { error: string }
> {
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

export async function checkIntegrations(
  ctx: RunContext,
): Promise<SectionOutput> {
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
          recommendation:
            "Network issue or Groq unreachable; AI calls may fail.",
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

  // --- DeepSeek (optional secondary AI provider) ---------------------------
  const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  checks.push({
    id: "deepseek-config",
    label: "DeepSeek · configuration",
    status: hasDeepseek ? "pass" : "skip",
    detail: hasDeepseek
      ? "key set"
      : "DEEPSEEK_API_KEY not set — optional provider, DeepSeek models will be skipped",
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

  // --- LLM model health: actually answer with each catalog model -----------
  // A real (tiny) completion per model — the only true "is the LLM working?"
  // test. Token cost is a handful of tokens per model, so it's gated behind
  // live probe like every other network call here.
  let note: string | undefined;
  if (ctx.liveProbe) {
    const probes = await Promise.all(
      MODEL_CATALOG.map((m) => probeModel(m.provider, m.model)),
    );
    checks.push(...probes);
  } else {
    checks.push({
      id: "model-health",
      label: `LLM model health (${MODEL_CATALOG.length} models)`,
      status: "skip",
      detail:
        "Live probe off — enable 'Live probes' to send a tiny prompt to each catalog model (spends a few tokens).",
    });
    note =
      "Per-model LLM probes run only with live probing on, since they spend a few tokens each.";
  }

  return { checks, note };
}
