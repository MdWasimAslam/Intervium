"use client";

import { useTheme } from "next-themes";

/**
 * Button that toggles between light and dark mode.
 *
 * The two icons are shown/hidden purely via the Tailwind `dark:` variant
 * (driven by the `.dark` class that next-themes sets on <html>), so the
 * markup is identical on the server and client — no hydration mismatch and
 * no mount-state effect required.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {/* Shown in light mode (click → switch to dark) */}
      <span className="dark:hidden">🌙</span>
      {/* Shown in dark mode (click → switch to light) */}
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}
