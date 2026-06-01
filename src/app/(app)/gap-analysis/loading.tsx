import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the gap-analysis page (an AI report runs server-side). */
export default function GapAnalysisLoading() {
  return (
    <Container className="max-w-3xl py-10 sm:py-12">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 space-y-4">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </Container>
  );
}
