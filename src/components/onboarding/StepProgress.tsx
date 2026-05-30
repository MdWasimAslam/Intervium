"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  steps: string[];
  current: number;
}

/**
 * Onboarding progress: a row of connected dots that fill as you advance, with
 * an animated track behind them and a "Step X of N · Title" caption. The fill
 * width is driven by framer-motion so progress glides rather than jumps.
 */
export function StepProgress({ steps, current }: StepProgressProps) {
  const total = steps.length;
  // Fraction of the track that should be filled (0 at first step, 1 at last).
  const pct = total > 1 ? (current / (total - 1)) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        {/* Track */}
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--secondary)]" />
        {/* Animated fill */}
        <motion.div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--primary)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 240, damping: 30 }}
        />
        {/* Dots */}
        <ol className="relative flex items-center justify-between">
          {steps.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={label} className="flex">
                <motion.span
                  aria-current={active ? "step" : undefined}
                  initial={false}
                  animate={{ scale: active ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
                    done &&
                      "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]",
                    active &&
                      "border-[var(--primary)] bg-[var(--background)] text-[var(--primary)] ring-4 ring-[var(--primary)]/15",
                    !done &&
                      !active &&
                      "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </motion.span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Step {current + 1} of {total} ·{" "}
        <span className="font-medium text-[var(--foreground)]">
          {steps[current]}
        </span>
      </p>
    </div>
  );
}
