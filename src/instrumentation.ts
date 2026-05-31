/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use it to validate required environment variables up front, so a
 * misconfigured deployment fails fast with a clear message at boot rather than
 * surfacing cryptic errors on the first request that needs the DB / Groq / auth.
 */
export async function register() {
  // Only the Node.js server runtime has the secrets; skip the Edge runtime
  // (and the browser), which don't run this validation.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
