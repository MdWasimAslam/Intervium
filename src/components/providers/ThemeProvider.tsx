"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps the app with `next-themes`.
 *
 * - `attribute="class"` toggles the `.dark` class on <html> (matches the
 *   Tailwind dark variant in globals.css).
 * - `defaultTheme="system"` + `enableSystem` → first visit follows the OS
 *   preference; the user's manual choice is then persisted to localStorage and
 *   wins thereafter.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Honour the OS "reduce motion" setting across all framer-motion. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
