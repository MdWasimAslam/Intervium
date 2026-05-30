/**
 * Application-wide constants.
 * Centralising these avoids magic strings scattered across the codebase.
 */

/** App metadata used in layout, navbar and footer. */
export const APP_NAME = "Next SaaS Starter";
export const APP_DESCRIPTION =
  "A production-ready Next.js (App Router) + TypeScript + Tailwind starter template.";

/**
 * Base URL for API calls.
 * Falls back to a relative "/api" path so the app works even when the
 * environment variable is not set (e.g. on a fresh clone).
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

/** Primary navigation links rendered by the Navbar. */
export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Dashboard", href: "/dashboard" },
] as const;

/** Selectable roles for the user form. */
export const USER_ROLES = ["admin", "member", "guest"] as const;
