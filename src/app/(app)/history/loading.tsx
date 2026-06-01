import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the interview history list. */
export default function HistoryLoading() {
  return (
    <Container className="py-10 sm:py-12">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}
