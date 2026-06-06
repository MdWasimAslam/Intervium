import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-3 h-4 w-56" />
        </div>

        {/* Hero + latest */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>

        {/* Stats */}
        <div>
          <Skeleton className="mb-3 h-5 w-36" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Recent + profile */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    </Container>
  );
}
