import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";

/**
 * Access control for the developer-only QA Center.
 *
 * Two gates, both must pass:
 *   1. The user is an admin (reuses the app's existing `requireAdmin`).
 *   2. The dashboard is *enabled* for this environment.
 *
 * Enablement: `QA_DASHBOARD_ENABLED` wins when set ("true"/"1" → on, anything
 * else → off). When unset, it defaults to on outside production so it's freely
 * available in dev/preview but invisible (404) in production unless explicitly
 * switched on. This is checked server-side in BOTH the page and the API route
 * because Next middleware does not run on `/api/*`.
 */
export function isQaEnabled(): boolean {
  const flag = process.env.QA_DASHBOARD_ENABLED?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Require admin + an enabled dashboard. Non-admins are redirected by
 * `requireAdmin`; a disabled dashboard yields a 404 so the route is invisible.
 * Returns the current admin user.
 */
export async function requireQaAccess() {
  const user = await requireAdmin();
  if (!isQaEnabled()) notFound();
  return user;
}
