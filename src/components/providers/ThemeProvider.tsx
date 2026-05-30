"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps the app with `next-themes`.
 *
 * - `attribute="class"` toggles the `.dark` class on <html> (matches the
 *   Tailwind dark variant in globals.css).
 * - `defaultTheme="light"` → the app defaults to light/white.
 * - The user's choice is persisted to localStorage automatically.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {/* Honour the OS "reduce motion" setting across all framer-motion. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
