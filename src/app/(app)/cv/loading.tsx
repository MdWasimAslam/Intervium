import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the CV workspace (header + tabs + editor/preview grid). */
export default function CvLoading() {
  return (
    <Container className="py-10 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-64 rounded-full" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[28rem] rounded-2xl" />
        <Skeleton className="h-[28rem] rounded-2xl" />
      </div>
    </Container>
  );
}
