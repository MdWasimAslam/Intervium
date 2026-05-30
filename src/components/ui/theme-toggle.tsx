"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Sun/Moon theme toggle.
 *
 * Both icons are always rendered and shown/hidden purely via the Tailwind
 * `dark:` variant, so the markup is identical on the server and client —
 * no hydration mismatch and no mount-state effect needed.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggle}
    >
      {/* Light mode shows the moon (click → dark) */}
      <Sun className="hidden dark:block" />
      {/* Dark mode shows the sun (click → light) */}
      <Moon className="block dark:hidden" />
    </Button>
  );
}
