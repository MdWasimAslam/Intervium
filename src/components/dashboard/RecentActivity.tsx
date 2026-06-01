import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentSession } from "@/lib/dashboard";

const MODE_LABEL: Record<string, string> = {
  bank: "Question Bank",
  ai: "AI",
};

/** Recent completed sessions, each linking to its full results breakdown. */
export function RecentActivity({
  sessions,
  showViewAll,
}: {
  sessions: RecentSession[];
  showViewAll: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {showViewAll && (
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] transition-colors hover:opacity-80"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No completed interviews yet"
          description="Finish your first interview and it'll show up here with your score and a link to the full breakdown."
          action={
            <Link href="/interview/new">
              <Button>Start your first interview</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/interview/${s.id}/results`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--muted)]/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.role} ·{" "}
                      {MODE_LABEL[s.mode] ?? s.mode} · {s.tech}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {s.date}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-right">
                      <span className="font-semibold text-[var(--primary)] tabular-nums">
                        {s.pct}%
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)] tabular-nums">
                        {s.totalScore}/{s.maxScore}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
