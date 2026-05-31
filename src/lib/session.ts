import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, profiles, users } from "@db";
import { auth } from "@/auth";

/**
 * Server-side auth helpers for use in Server Components and route handlers.
 * These do real session checks — never rely on middleware alone for
 * authorization (especially admin checks).
 */

/**
 * Return the current user, or `null` if not signed in.
 *
 * This is the real revocation-enforcement point: the JWT carries a snapshot of
 * the user's role/active state and is NOT reconciled against the DB in the Edge
 * middleware. So on every server-side check we re-read the `users` row and:
 *   - treat a missing or deactivated user as signed out (return null), and
 *   - return the *fresh* DB role, so a demotion takes effect immediately.
 * If the DB read fails we fall back to the JWT user rather than locking
 * everyone out on a transient error.
 */
export async function getCurrentUser() {
  const session = await auth();
  const user = session?.user ?? null;
  if (!user?.id) return user;

  try {
    const [row] = await db
      .select({ isActive: users.isActive, role: users.role })
      .from(users)
      .where(eq(users.id, user.id));

    // Gone or deactivated → treat as signed out.
    if (!row || row.isActive === false) return null;

    // Use the current DB role so demotions/promotions apply right away.
    return { ...user, role: row.role };
  } catch (error) {
    console.error("[getCurrentUser] DB re-validation failed", error);
    return user;
  }
}

/**
 * Has the user finished the onboarding wizard?
 *
 * Onboarding completion lives in `profiles.onboarding.completed` (jsonb) rather
 * than the JWT, so this can't run in Edge middleware — call it from Server
 * Components. Mirrors the guard already used by the interview setup page.
 */
export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ onboarding: profiles.onboarding })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  const onboarding = (row?.onboarding ?? {}) as { completed?: boolean };
  return onboarding.completed === true;
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require an admin; redirect non-admins to /dashboard, guests to /login. */
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
