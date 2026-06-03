import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { requireAuth } from "@/lib/session";
import {
  countDue,
  getDojoStats,
  getDojoStreak,
  getQuestionBySlug,
  listQuestions,
  listTopics,
  pickRandomSlug,
} from "@/lib/dojo/queries";
import type { DojoDifficulty } from "@/lib/dojo/types";
import { DojoWorkspace } from "@/components/dojo/DojoWorkspace";
import { DojoStatsStrip } from "@/components/dojo/DojoStatsStrip";

export const metadata: Metadata = { title: "Code Dojo" };

/**
 * /dojo — editor-first practice ground. Opens on a fresh Editor (the scratch
 * pad); a problem only loads when explicitly requested via `?problem=` (a deep
 * link or picking one from the Problems tab). Personal problems are private;
 * the built-in set is shared.
 */
export default async function DojoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim();
  const explicitSlug = first(sp.problem);

  const [items, topics, due, streak, stats] = await Promise.all([
    listQuestions(user.id),
    listTopics(),
    countDue(user.id),
    getDojoStreak(user.id),
    getDojoStats(user.id),
  ]);

  // Open a problem when one is explicitly requested (`?problem=`), or roll a
  // random one for the quick-start shortcut (`?random=1`, optionally scoped by
  // `&difficulty=` / `&topic=`). Otherwise the Editor tab shows a scratch editor.
  let wantedSlug = explicitSlug;
  let openedRandom = false;
  if (!wantedSlug && first(sp.random)) {
    const diff = first(sp.difficulty);
    const difficulty: DojoDifficulty | undefined =
      diff === "easy" || diff === "medium" || diff === "hard"
        ? diff
        : undefined;
    wantedSlug =
      (await pickRandomSlug(user.id, {
        topicSlug: first(sp.topic),
        difficulty,
      })) ?? undefined;
    openedRandom = wantedSlug !== undefined;
  }

  const initialDetail = wantedSlug
    ? await getQuestionBySlug(wantedSlug, user.id)
    : null;

  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Code Dojo
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Practice JavaScript & DSA problems, save your solutions, and revise.
          </p>
        </header>

        <DojoStatsStrip streak={streak} stats={stats} />

        {due > 0 && (
          <Link
            href="/dojo/review"
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/[0.06] px-4 py-3 transition-colors hover:bg-[var(--primary)]/10"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
              {due} problem{due === 1 ? "" : "s"} due for review
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">
              Review now <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}

        <DojoWorkspace
          items={items}
          topics={topics}
          initialDetail={initialDetail}
          initialFresh={openedRandom}
        />
      </div>
    </Container>
  );
}
