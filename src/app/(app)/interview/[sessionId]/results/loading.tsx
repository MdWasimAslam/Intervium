import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResultsLoading() {
  return (
    <Container className="max-w-2xl py-12">
      {/* Overall score card — matches the real responsive header layout. */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
          <Skeleton className="h-40 w-40 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mx-auto h-7 w-56 sm:mx-0" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Per-question breakdown */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Skeleton className="h-11 w-36 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
    </Container>
  );
}
