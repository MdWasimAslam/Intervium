import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import {
  DEMO_ACCESS_KEY_FALLBACK,
  DEMO_AI_MESSAGE,
  DEMO_DELETE_MESSAGE,
  normalizeDemoEmail,
} from "../../db/demo-data";

// Re-export the shared user-facing copy so callers can keep importing from
// "@/lib/demo" while the literals live in one place (db/demo-data.ts).
export { DEMO_AI_MESSAGE, DEMO_DELETE_MESSAGE };

/**
 * Read-mostly demo account support.
 *
 * One shared account (set via `DEMO_USER_EMAIL`) showcases the app to strangers.
 * AI calls and destructive deletes are ALWAYS blocked for it — at every stage,
 * regardless of any admin setting — so it can never run up the AI budget, probe
 * the model, or wipe the showcase. Detection is by email (from the JWT).
 *
 * Separately, the admin "demo access" toggle (`app_settings.demo_mode`) controls
 * whether visitors can REQUEST the demo credentials from the landing page. That
 * toggle does NOT affect the AI/delete locks — it only gates the public offer.
 */

/** The demo account's email, lowercased; null when no demo account is configured. */
const rawDemoEmail = process.env.DEMO_USER_EMAIL?.trim();
export const DEMO_USER_EMAIL = rawDemoEmail
  ? normalizeDemoEmail(rawDemoEmail)
  : null;

/**
 * The demo account's access key (password). Resolved from `DEMO_ACCESS_KEY` with
 * the shared fallback, so the invite email and the seed always agree on it.
 */
export const DEMO_ACCESS_KEY =
  process.env.DEMO_ACCESS_KEY?.trim() || DEMO_ACCESS_KEY_FALLBACK;

/** Is this email the configured demo account? (Ignores the on/off toggle.) */
export function isDemoEmail(email?: string | null): boolean {
  return (
    !!DEMO_USER_EMAIL &&
    !!email &&
    normalizeDemoEmail(email) === DEMO_USER_EMAIL
  );
}

/**
 * Guard for destructive/mutating actions on the shared demo account. Returns the
 * user-facing block message when `email` is the demo account, else `null`.
 * Single source of the demo-delete check + message so every mutation guards the
 * same way:
 *
 *   const blocked = requireNonDemo(user.email);
 *   if (blocked) return { ok: false, error: blocked };
 */
export function requireNonDemo(email?: string | null): string | null {
  return isDemoEmail(email) ? DEMO_DELETE_MESSAGE : null;
}

/**
 * Is the public "request demo access" offer enabled? Admin toggle, defaults ON.
 * Gates ONLY the landing-page request form — never the AI/delete locks.
 */
export async function isDemoAccessEnabled(): Promise<boolean> {
  return (await getSettings()).demoMode;
}

/**
 * Does the current session belong to the demo account? Email-based (reads the
 * JWT), so the AI/delete locks and the demo banner are ALWAYS in effect for it.
 *
 * Wrapped in React `cache` so the `auth()` JWT decode runs at most once per
 * request even when several call sites ask (e.g. the layout banner plus every
 * `generateContent` AI backstop in a multi-call scoring/CV flow).
 */
export const isDemoSession = cache(async (): Promise<boolean> => {
  if (!DEMO_USER_EMAIL) return false;
  const session = await auth();
  return isDemoEmail(session?.user?.email);
});
