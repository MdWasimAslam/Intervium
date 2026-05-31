import "server-only";

/**
 * Boot-time environment validation.
 *
 * The app cannot function without these server-side secrets: the database
 * connection, the auth session-signing secret, and the Groq API key that powers
 * question generation, scoring and CV AI. Validate them once at startup so we
 * fail fast with a clear message instead of throwing obscure errors deep inside
 * a request.
 *
 * Kept dependency-free (no zod) so it's safe to run from the Next.js
 * instrumentation hook before the rest of the app loads.
 */

/** Env vars that must be present and non-empty for the server to start. */
const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "GROQ_API_KEY",
] as const;

export type RequiredEnv = (typeof REQUIRED_ENV)[number];

/**
 * Assert every required env var is present and non-empty. Throws a single
 * aggregated error listing everything missing.
 */
export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = process.env[key];
    return value === undefined || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in .env.local (see .env.example) or your deployment config.`,
    );
  }
}
