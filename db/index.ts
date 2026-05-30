import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Drizzle ORM client backed by the Neon serverless (HTTP) driver.
 *
 * `DATABASE_URL` is provided by the Vercel ↔ Neon integration in production
 * and from `.env.local` during local development.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

export const db = drizzle(neon(databaseUrl), { schema });

export { schema };
export * from "./schema";
