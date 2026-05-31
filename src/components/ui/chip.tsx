import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pill-style chip used for tags / labels / status badges in the minimal
 * aesthetic. The `tone` variant gives consistent status colours so badges
 * never mix a pill with bare muted text.
 */
const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        accent:
          "border-[var(--border)] bg-[var(--accent)] text-[var(--accent-foreground)]",
        neutral:
          "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]",
        success:
          "border-[var(--primary)]/30 bg-[var(--accent)] text-[var(--accent-foreground)]",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        danger:
          "border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]",
      },
    },
    defaultVariants: {
      tone: "accent",
    },
  },
);

export interface ChipProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(chipVariants({ tone }), className)} {...props} />
  ),
);
Chip.displayName = "Chip";

export { Chip, chipVariants };
