import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the profile editor (header + sectioned cards). */
export default function ProfileLoading() {
  return (
    <Container className="max-w-2xl py-10 sm:py-12">
      <Skeleton className="h-4 w-36" />

      <div className="mt-4 mb-8 flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}
