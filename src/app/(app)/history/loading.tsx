import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the interview history list. */
export default function HistoryLoading() {
  return (
    <Container className="py-10 sm:py-12">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />

      {/* Single card with divided rows, mirroring the real history list. */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="space-y-1.5 text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                  <Skeleton className="ml-auto h-3 w-14" />
                </div>
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
