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
 * reload. Without this, lingering pools accumulate connections and exhaust
 * the Supabase pooler → `EMAXCONNSESSION`.
 *
 * NOTE: `DATABASE_URL` must point at Supabase's **transaction-mode** pooler
 * (port 6543), not the session-mode pooler (port 5432). Session mode pins a
 * server connection for each client connection's full lifetime and caps total
 * clients at `pool_size: 15`, so an idle app pool plus any second consumer
 * (another `npm run dev`, a seed, Drizzle Studio) trips `EMAXCONNSESSION`.
 * Transaction mode only holds a connection per statement/transaction, so the
 * same `max` supports far more concurrent work. node-postgres uses unnamed
 * statements by default, so it is compatible with transaction-mode pooling.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
    max: 10,
    // Release idle clients so a parked pool doesn't pin pooler slots
    // (matters most in dev/HMR and when other processes share the pooler).
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
export * from "./schema";
