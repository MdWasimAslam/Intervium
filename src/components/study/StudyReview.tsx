"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { rateStudyNote } from "@/lib/actions/study";
import type { StudyRating, StudyReviewCard } from "@/lib/study/types";

const OPTIONS: { rating: StudyRating; label: string; cls: string }[] = [
  {
    rating: "again",
    label: "Again",
    cls: "border-[var(--destructive)]/30 text-[var(--destructive)] hover:bg-[var(--destructive)]/10",
  },
  {
    rating: "hard",
    label: "Hard",
    cls: "border-[var(--warning)]/30 text-[var(--warning)] hover:bg-[var(--warning-subtle)]",
  },
  {
    rating: "good",
    label: "Good",
    cls: "border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success-subtle)]",
  },
  {
    rating: "easy",
    label: "Easy",
    cls: "border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/10",
  },
];

export function StudyReview({ cards }: { cards: StudyReviewCard[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState<StudyRating | null>(null);
  const [error, setError] = useState<string>();

  const card = cards[index];
  const done = index >= cards.length;

  async function rate(rating: StudyRating) {
    if (!card) return;
    setPending(rating);
    setError(undefined);
    const res = await rateStudyNote({ id: card.id, rating });
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-[var(--success)]" />
          <div className="space-y-1">
            <h3 className="font-semibold">Review complete</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              You reviewed {cards.length} card{cards.length === 1 ? "" : "s"}.
              Nice work.
            </p>
          </div>
          <Button onClick={() => router.push("/study")}>Back to notes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <Link href="/study" className="hover:text-[var(--foreground)]">
          Exit
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 elev-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Question
        </p>
        <p className="text-lg font-medium">{card.title}</p>

        {revealed ? (
          <div className="mt-5 space-y-2 border-t border-[var(--border)] pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Answer
            </p>
            {card.content ? (
              <Markdown>{card.content}</Markdown>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                (No answer recorded.)
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <Button onClick={() => setRevealed(true)}>Reveal answer</Button>
          </div>
        )}
      </div>

      {revealed && (
        <div className="space-y-2">
          <p className="text-sm font-medium">How well did you know this?</p>
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
        </div>
      )}

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
