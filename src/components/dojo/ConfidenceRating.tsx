"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { rateDojoQuestion } from "@/lib/actions/dojo";
import type { DojoRating } from "@/lib/dojo/types";

const OPTIONS: { rating: DojoRating; label: string; cls: string }[] = [
  {
    rating: "again",
    label: "Again",
    cls: "border-[var(--destructive)]/30 text-[var(--destructive)] hover:bg-[var(--destructive)]/10",
  },
  {
    rating: "hard",
    label: "Hard",
    cls: "border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
  },
  {
    rating: "good",
    label: "Good",
    cls: "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    rating: "easy",
    label: "Easy",
    cls: "border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/10",
  },
];

function dueLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/**
 * Anki-style self-rating shown after solving. Advances the spaced-repetition
 * schedule and tells the learner when the problem will resurface for review.
 */
export function ConfidenceRating({ questionId }: { questionId: string }) {
  const [pending, setPending] = useState<DojoRating | null>(null);
  const [result, setResult] = useState<{
    dueInDays: number;
    nextDueSlug: string | null;
  } | null>(null);
  const [error, setError] = useState<string>();

  async function rate(rating: DojoRating) {
    setPending(rating);
    setError(undefined);
    const res = await rateDojoQuestion({ questionId, rating });
    setPending(null);
    if (res.ok) {
      setResult({
        dueInDays: res.data.dueInDays,
        nextDueSlug: res.data.nextDueSlug,
      });
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div>
        <p className="text-sm font-semibold">How well did you know this?</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Schedules when this problem comes back for revision.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((o) => (
          <button
            key={o.rating}
            type="button"
            onClick={() => rate(o.rating)}
            disabled={pending !== null}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium transition-colors disabled:opacity-60",
              o.cls,
            )}
          >
            {pending === o.rating ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              o.label
            )}
          </button>
        ))}
      </div>
      {result && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--primary)]">
            Saved — back for review {dueLabel(result.dueInDays)}.
          </p>
          {result.nextDueSlug && (
            <Link href={`/dojo/${result.nextDueSlug}`}>
              <Button size="sm" variant="outline">
                Review next <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      )}
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
