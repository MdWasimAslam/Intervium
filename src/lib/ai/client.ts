import { z } from "zod";
import { logAiCall } from "@/lib/ai-logging";
import { getAiProvider } from "@/lib/settings";

/** A clean, UI-safe error for any generation failure. */
export class QuestionGenerationError extends Error {}

// Fast is for cheap/high-volume generation. Smart is for judgment-heavy tasks.
export const FAST_MODEL =
  process.env.GROQ_FAST_MODEL?.trim() || "llama-3.1-8b-instant";
export const SMART_MODEL =
  process.env.GROQ_SMART_MODEL?.trim() || "llama-3.3-70b-versatile";
export const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
type GroqModelTier = "fast" | "smart";

/**
 * Which AI backend a call uses. Both speak the OpenAI chat-completions wire
 * format, so the only differences are the base URL, API key and model name —
 * everything else (retry, timeout, JSON parsing, usage logging) is shared.
 */
export type AiProvider = "groq" | "deepseek";

const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";

/** Resolve the endpoint, key and model for a provider (throws if unconfigured). */
function resolveProvider(
  provider: AiProvider,
  tier: GroqModelTier,
): { apiKey: string; url: string; model: string; label: string } {
  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw new QuestionGenerationError(
        "DeepSeek is not configured (missing DEEPSEEK_API_KEY).",
      );
    }
    const base = (
      process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    return {
      apiKey,
      url: `${base}/chat/completions`,
      model: process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL,
      label: "DeepSeek",
    };
  }
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new QuestionGenerationError(
      "Groq is not configured (missing GROQ_API_KEY).",
    );
  }
  return {
    apiKey,
    url: GROQ_CHAT_COMPLETIONS_URL,
    model: tier === "smart" ? SMART_MODEL : FAST_MODEL,
    label: "Groq",
  };
}

/** HTTP statuses worth retrying — transient timeouts, rate limits, gateway/server errors. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
/** Per-request timeout, kept below the 60s function limit. */
const GROQ_REQUEST_TIMEOUT_MS = 25_000;
/** Transient-failure retry policy (layered under the JSON-validation retries). */
const MAX_TRANSIENT_ATTEMPTS = 3;
/** Cap any single backoff wait (incl. a Retry-After hint) so we stay under the function limit. */
const MAX_BACKOFF_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into ms, capped. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(0, seconds * 1000), MAX_BACKOFF_MS);
  }
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    return Math.min(Math.max(0, when - Date.now()), MAX_BACKOFF_MS);
  }
  return null;
}

interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  // Groq returns token counts here when available.
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

/** Lazily create the client so the build never needs the key. */
export function getModel(
  opts: {
    json?: boolean;
    temperature?: number;
    tier?: GroqModelTier;
    /** AI backend for this call. Defaults to Groq. */
    provider?: AiProvider;
    /** Feature label for usage logging; omit to skip logging this call. */
    feature?: string;
    /** User the call is attributed to (for the AI Usage dashboard). */
    userId?: string | null;
    /**
     * Optional best-effort determinism seed. Sent to the model only when set,
     * so variety-seeking callers (interview generation) are unaffected.
     */
    seed?: number;
  } = {},
) {
  const {
    json = true,
    temperature = 0.9,
    tier = "fast",
    provider = "groq",
    feature,
    userId,
    seed,
  } = opts;
  const { apiKey, url, model, label } = resolveProvider(provider, tier);

  // Record one usage-log row per logical call (success carries token counts;
  // terminal failures log a status="error" row). No-op when feature is unset.
  const emit = (
    status: "success" | "error",
    usage?: GroqChatResponse["usage"],
  ) =>
    feature
      ? logAiCall({
          userId,
          feature,
          model,
          status,
          inputTokens: usage?.prompt_tokens ?? null,
          outputTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
        })
      : Promise.resolve();

  return {
    async generateContent(prompt: string): Promise<string> {
      const systemPrompt = json
        ? "Return only valid JSON matching the user's requested shape. Do not include markdown, code fences, or explanatory prose."
        : "Follow the user's output instructions exactly. Keep the response concise.";

      const body = JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        stream: false,
        // Best-effort determinism: same input → same seed → (ideally) same
        // output. Groq doesn't hard-guarantee this, so the CV action layer
        // also content-caches results — but the seed makes repeats far stabler.
        ...(seed !== undefined ? { seed } : {}),
      });

      // Transient-retry loop (429/5xx/408 + network/timeout) with exponential
      // backoff + jitter. The per-attempt timeout (25s) aborts a hung request
      // so a single call can never eat the whole 60s function budget. The
      // JSON-validation retry loops in the callers sit on top of this.
      try {
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
          let res: Response;
          try {
            res = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body,
              signal: AbortSignal.timeout(GROQ_REQUEST_TIMEOUT_MS),
            });
          } catch (error) {
            // Network failure or the abort timeout firing — both are transient.
            const isTimeout =
              error instanceof Error &&
              (error.name === "TimeoutError" || error.name === "AbortError");
            lastError = isTimeout
              ? new Error(`${label} request timed out`)
              : error;
            if (attempt < MAX_TRANSIENT_ATTEMPTS) {
              await sleep(
                Math.min(2 ** (attempt - 1) * 500, MAX_BACKOFF_MS) +
                  Math.random() * 200,
              );
              continue;
            }
            throw lastError;
          }

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            const err = new Error(
              `${label} ${res.status}: ${detail.slice(0, 500)}`,
            );
            if (
              RETRYABLE_STATUSES.has(res.status) &&
              attempt < MAX_TRANSIENT_ATTEMPTS
            ) {
              lastError = err;
              const retryAfter =
                res.status === 429
                  ? parseRetryAfter(res.headers.get("retry-after"))
                  : null;
              const backoff =
                retryAfter ??
                Math.min(2 ** (attempt - 1) * 500, MAX_BACKOFF_MS);
              await sleep(backoff + Math.random() * 200);
              continue;
            }
            throw err;
          }

          const data = (await res.json()) as GroqChatResponse;
          const text = data.choices?.[0]?.message?.content?.trim();
          if (!text) {
            throw new Error(
              data.error?.message ?? `${label} returned an empty response.`,
            );
          }
          await emit("success", data.usage);
          return text;
        }

        // Exhausted transient retries.
        throw lastError instanceof Error
          ? lastError
          : new Error(`${label} request failed after retries.`);
      } catch (error) {
        // Terminal failure for this call — record an error row, then rethrow.
        await emit("error");
        throw error;
      }
    },
  };
}

/** Remove accidental ```json … ``` fences if the model adds them. */
export function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractJsonCandidate(text: string): string {
  const stripped = stripFences(text);
  const start = stripped.search(/[\[{]/);
  if (start < 0) return stripped;

  const opener = stripped[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === opener) {
      depth++;
    } else if (ch === closer) {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }

  return stripped.slice(start);
}

export function escapeControlCharsInJsonStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code >= 0x00 && code <= 0x1f) {
        switch (ch) {
          case "\b":
            out += "\\b";
            break;
          case "\f":
            out += "\\f";
            break;
          case "\n":
            out += "\\n";
            break;
          case "\r":
            out += "\\r";
            break;
          case "\t":
            out += "\\t";
            break;
          default:
            out += `\\u${code.toString(16).padStart(4, "0")}`;
        }
        continue;
      }
    } else if (ch === '"') {
      inString = true;
    }

    out += ch;
  }

  return out;
}

export function parseModelJson(raw: string): unknown {
  const candidate = extractJsonCandidate(raw);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(escapeControlCharsInJsonStrings(candidate));
  }
}

/** Clean error for any CV generation failure. */
export class CvAiError extends Error {}

/** Run a JSON-returning Groq prompt with the standard retry-strict loop. */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  buildPrompt: (strict: boolean) => string,
  opts: {
    temperature?: number;
    label: string;
    feature?: string;
    userId?: string | null;
    /** Stable seed for determinism (see `getModel`). */
    seed?: number;
  },
): Promise<T> {
  const model = getModel({
    json: true,
    temperature: opts.temperature ?? 0.5,
    tier: "smart",
    provider: await getAiProvider(),
    feature: opts.feature,
    userId: opts.userId,
    seed: opts.seed,
  });
  let lastIssue: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateContent(buildPrompt(attempt === 2));
    } catch (error) {
      console.error(`[groq:${opts.label}] request failed:`, error);
      throw new CvAiError(
        "We couldn't reach the AI right now. Please try again.",
      );
    }
    try {
      return schema.parse(parseModelJson(raw));
    } catch (error) {
      lastIssue = error;
      console.warn(`[groq:${opts.label}] invalid output on attempt ${attempt}`);
    }
  }

  console.error(`[groq:${opts.label}] giving up:`, lastIssue);
  throw new CvAiError(
    "The AI returned an unexpected response. Please try again.",
  );
}
