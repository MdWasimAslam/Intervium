"use client";

import { cn } from "@/lib/utils";

/**
 * Pill-style tab button used in segmented tab navs (CV workspace, Code Dojo).
 * Active = brand-filled; inactive = muted with hover. Wrap a row of these in a
 * `inline-flex rounded-full border bg-[var(--card)] p-1` container.
 */
export function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
