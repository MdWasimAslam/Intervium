import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAuth } from "@/lib/session";
import { listDueCards } from "@/lib/study/queries";
import { StudyReview } from "@/components/study/StudyReview";

export const metadata: Metadata = { title: "Review · Study Notes" };

/** Spaced-repetition review queue: flashcards whose review date has arrived. */
export default async function StudyReviewPage() {
  const user = await requireAuth();
  const cards = await listDueCards(user.id);

  return (
    <Container className="py-10 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <Link
            href="/study"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" /> Study Notes
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Review</h1>
        </div>

        {cards.length === 0 ? (
          <EmptyState
            title="All caught up"
            description="No flashcards are due right now. Create flashcards and review them to build your queue."
          />
        ) : (
          <StudyReview cards={cards} />
        )}
      </div>
    </Container>
  );
}
