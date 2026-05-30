import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import type { User } from "@/types";

/**
 * The single hardcoded user for this app. There is no registration flow —
 * this account is seeded into the database the first time it is needed.
 *
 * NOTE: credentials are intentionally hardcoded per the project brief.
 */
export const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Wasim@slam1998";

/** Tracks whether seeding ran in this process to avoid repeat work. */
let seeded = false;

/**
 * Ensure the `users` table exists and the admin account is present.
 * Idempotent: safe to call on every login attempt.
 */
export async function ensureAdminUser(): Promise<void> {
  if (seeded) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const existing = await sql`
    SELECT id FROM users WHERE username = ${ADMIN_USERNAME}
  `;

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${ADMIN_USERNAME}, ${passwordHash})
    `;
  }

  seeded = true;
}

/**
 * Look up a user by username and verify the supplied password.
 * Returns the user on success, or `null` on any failure.
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<User | null> {
  await ensureAdminUser();

  const sql = getSql();
  const rows = await sql`
    SELECT id, username, password_hash, created_at
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0] as {
    id: number;
    username: string;
    password_hash: string;
    created_at: string;
  };

  const isValid = await bcrypt.compare(password, row.password_hash);
  if (!isValid) return null;

  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
}
