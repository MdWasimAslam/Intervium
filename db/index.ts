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

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export { schema };
export * from "./schema";
