import { db } from "./index";

/**
 * Transaction helper.
 *
 * The node-postgres pool backing `db` supports interactive transactions, so we
 * simply reuse the shared client — no separate driver/connection needed (the
 * old Neon HTTP driver couldn't, which is why this used its own WebSocket pool).
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside a single database transaction. The callback receives a
 * transaction-scoped Drizzle client.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}
