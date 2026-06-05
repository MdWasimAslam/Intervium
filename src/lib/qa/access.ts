import "server-only";
import { requireAdmin } from "@/lib/session";

/**
 * Access control for the QA Center.
 *
 * The dashboard is gated by a single rule: the user must be an admin. There is
 * no separate enable/disable flag — it is available in every environment to
 * admins only. Authorization is enforced server-side in BOTH the page and the
 * API route because Next middleware does not run on `/api/*`.
 */

/**
 * Require an admin user. Non-admins are redirected by `requireAdmin`.
 * Returns the current admin user.
 */
export async function requireQaAccess() {
  return requireAdmin();
}
