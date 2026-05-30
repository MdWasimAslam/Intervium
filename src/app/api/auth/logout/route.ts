import { success } from "@/api/response";
import { destroySession } from "@/lib/session";

/**
 * POST /api/auth/logout
 * Clear the session cookie.
 */
export async function POST() {
  await destroySession();
  return success({ ok: true }, "Logged out successfully.");
}
