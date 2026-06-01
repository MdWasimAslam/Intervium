import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAuth } from "@/lib/session";
import { listDueQuestions } from "@/lib/dojo/queries";
import { DifficultyBadge } from "@/components/dojo/DifficultyBadge";

export const metadata: Metadata = { title: "Review · Code Dojo" };

/** Spaced-repetition review queue: problems whose review date has arrived. */
export default async function DojoReviewPage() {
  const user = await requireAuth();
  const due = await listDueQuestions(user.id);

  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-6">
        <div className="space-y-2">
          <Link
            href="/dojo"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" /> Code Dojo
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
          <p className="text-[var(--muted-foreground)]">
            Problems due for spaced revision — solve them again and re-rate to
            push the next review further out.
          </p>
        </div>

        {due.length === 0 ? (
          <EmptyState
            title="All caught up"
            description="Nothing's due for review right now. Solve problems and rate your confidence to build your revision queue."
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--muted-foreground)]">
                {due.length} due for review
              </span>
              <Link href={`/dojo/${due[0].slug}`}>
                <Button size="sm">
                  Review next <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
              {due.map((it) => (
                <li key={it.slug}>
                  <Link
                    href={`/dojo/${it.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--muted)]/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {it.title}
                      </span>
                      {it.topics.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {it.topics.map((t) => (
                            <Chip key={t.slug} className="text-xs">
                              {t.name}
                            </Chip>
                          ))}
                        </span>
                      )}
                    </span>
                    <DifficultyBadge difficulty={it.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Container>
  );
}
