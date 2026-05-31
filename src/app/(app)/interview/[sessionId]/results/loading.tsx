import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResultsLoading() {
  return (
    <Container className="max-w-2xl py-12">
      <Card className="mb-6">
        <CardContent className="flex items-center gap-8 p-8">
          <Skeleton className="h-40 w-40 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </Container>
  );
}
