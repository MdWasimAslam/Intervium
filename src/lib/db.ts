import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon (Postgres) database client.
 *
 * Uses the serverless HTTP driver, ideal for short-lived serverless/edge
 * function calls. The connection string comes from the Vercel ↔ Neon
 * integration as `POSTGRES_URL` (falls back to `DATABASE_URL`).
 *
 * The client is created lazily on first use so that importing this module
 * never throws during the build (when env vars may be absent).
 *
 * Usage (tagged template — parameters are safely escaped):
 *   const rows = await getSql()`SELECT * FROM users WHERE username = ${name}`;
 */
let client: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (client) return client;

  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Set POSTGRES_URL (or DATABASE_URL).",
    );
  }

  client = neon(connectionString);
  return client;
}
