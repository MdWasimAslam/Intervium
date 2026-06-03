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
          "border-[var(--success)]/30 bg-[var(--success-subtle)] text-[var(--success)]",
        warning:
          "border-[var(--warning)]/30 bg-[var(--warning-subtle)] text-[var(--warning)]",
        info: "border-[var(--info)]/30 bg-[var(--info-subtle)] text-[var(--info)]",
        danger:
          "border-[var(--destructive)]/30 bg-[var(--destructive-subtle)] text-[var(--destructive)]",
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
