import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, profiles } from "@db";
import { auth } from "@/auth";

/**
 * Server-side auth helpers for use in Server Components and route handlers.
 * These do real session checks — never rely on middleware alone for
 * authorization (especially admin checks).
 */

/** Return the current user, or `null` if not signed in. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
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
