import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import {
  drizzle,
  type NeonDatabase,
} from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Transaction helper.
 *
 * The Neon HTTP driver used in `db/index.ts` is great for one-shot queries
 * but does NOT support interactive transactions. For atomic multi-statement
 * work (e.g. the access-code registration gate) we use the WebSocket-based
 * `Pool` driver, which does.
 */

// Neon needs a WebSocket implementation in Node runtimes that lack a global one.
neonConfig.webSocketConstructor = ws;

type Tx = Parameters<Parameters<NeonDatabase<typeof schema>["transaction"]>[0]>[0];

/**
 * Run `fn` inside a single database transaction, then close the pool.
 * The callback receives a transaction-scoped Drizzle client.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    return await db.transaction(fn);
  } finally {
    await pool.end();
  }
}
