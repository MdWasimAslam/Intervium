import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ClipboardList } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db, interviewSessions, jobRoles, techStacks } from "@db";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isOnboardingComplete, requireAuth } from "@/lib/session";

export const metadata: Metadata = { title: "History" };

const MODE_LABEL: Record<string, string> = {
  bank: "Question Bank",
  ai: "AI",
};

/**
 * Full interview history (read-only). Every session the user has run, newest
 * first — completed sessions link to their results, in-progress ones resume.
 */
const PAGE_SIZE = 20;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  if (!(await isOnboardingComplete(user.id))) redirect("/onboarding");

  const sp = await searchParams;
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(rawPage) || 1);

  // Paginate: uses the interview_sessions_user_id_idx for both the count and
  // the page slice, instead of pulling every session into memory.
  const total = await db.$count(
    interviewSessions,
    eq(interviewSessions.userId, user.id),
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const sessions = await db
    .select({
      id: interviewSessions.id,
      role: jobRoles.name,
      tech: techStacks.name,
      mode: interviewSessions.mode,
      status: interviewSessions.status,
      totalScore: interviewSessions.totalScore,
      maxScore: interviewSessions.maxScore,
      scoredAt: interviewSessions.scoredAt,
      startedAt: interviewSessions.startedAt,
    })
    .from(interviewSessions)
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
    .where(eq(interviewSessions.userId, user.id))
    .orderBy(desc(interviewSessions.startedAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  return (
    <Container className="py-10 sm:py-12">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="mb-1 text-3xl font-bold tracking-tight">
        Interview history
      </h1>
      <p className="mb-8 text-[var(--muted-foreground)]">
        {total === 0
          ? "Every interview you run will be listed here."
          : `${total} interview${total === 1 ? "" : "s"} so far.`}
      </p>

      {total === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No interviews yet"
          description="Start your first mock interview to build up your history and scores."
          action={
            <Link href="/interview/new">
              <Button>Start your first interview</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map((s) => {
              const scored = s.status === "completed" && s.scoredAt;
              // Completed sessions show results (scoring kicks off there if
              // needed); in-progress sessions resume the interview.
              const href =
                s.status === "completed"
                  ? `/interview/${s.id}/results`
                  : `/interview/${s.id}`;
              const date = (s.scoredAt ?? s.startedAt)
                .toISOString()
                .slice(0, 10);

              return (
                <li key={s.id}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--muted)]/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {s.role} · {MODE_LABEL[s.mode] ?? s.mode} · {s.tech}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {date}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {scored ? (
                        <span className="text-right">
                          <span className="font-semibold text-[var(--primary)] tabular-nums">
                            {s.maxScore > 0
                              ? Math.round((s.totalScore / s.maxScore) * 100)
                              : 0}
                            %
                          </span>
                          <span className="block text-xs text-[var(--muted-foreground)] tabular-nums">
                            {s.totalScore}/{s.maxScore}
                          </span>
                        </span>
                      ) : (
                        <Chip>
                          {s.status === "completed" ? "Scoring…" : "In progress"}
                        </Chip>
                      )}
                      <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex gap-2">
            {safePage > 1 ? (
              <Link href={`/history?page=${safePage - 1}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4" /> Prev
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ArrowLeft className="h-4 w-4" /> Prev
              </Button>
            )}
            {safePage < totalPages ? (
              <Link href={`/history?page=${safePage + 1}`}>
                <Button variant="outline" size="sm">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}
