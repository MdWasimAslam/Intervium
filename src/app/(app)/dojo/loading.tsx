import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DojoLoading() {
  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>

        {/* Workspace: problem list + editor */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[60vh] rounded-2xl" />
          <Skeleton className="h-[60vh] rounded-2xl" />
        </div>
      </div>
    </Container>
  );
}
