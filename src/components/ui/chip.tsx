import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill-style chip used for tags / labels in the minimal aesthetic.
 */
const Chip = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-foreground)]",
      className,
    )}
    {...props}
  />
));
Chip.displayName = "Chip";

export { Chip };
