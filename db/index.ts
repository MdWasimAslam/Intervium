import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Drizzle ORM client backed by the node-postgres (pg) driver.
 *
 * `DATABASE_URL` is read from the environment (the hosted Postgres in
 * production, `.env.local` in development). SSL is enabled automatically for
 * non-local hosts — managed Postgres (Supabase, etc.) requires it.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

/** Local Postgres needs no SSL; any remote host (Supabase, …) requires it. */
export const isLocalDatabase = /@(localhost|127\.0\.0\.1)/.test(databaseUrl);

/**
 * Cache the pool on `globalThis` so Next.js dev HMR reuses a single pool
 * instead of leaking a new one (with its own connections) on every module
 * reload. Without this, lingering pools quickly exhaust the Supabase
 * session-mode pooler (`pool_size: 15`) → `EMAXCONNSESSION`.
 *
 * `max` is bounded well under the pooler's 15-client ceiling to leave
 * headroom for migrations/seeds and to keep a single pool from monopolizing it.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
export * from "./schema";
