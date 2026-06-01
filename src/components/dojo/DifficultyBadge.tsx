import { cn } from "@/lib/utils";
import type { DojoDifficulty } from "@/lib/dojo/types";

const CLS: Record<DojoDifficulty, string> = {
  easy: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  hard: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
};

const LABEL: Record<DojoDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function DifficultyBadge({ difficulty }: { difficulty: DojoDifficulty }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        CLS[difficulty],
      )}
    >
      {LABEL[difficulty]}
    </span>
  );
}
