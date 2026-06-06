import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the CV workspace (tab nav + editor/preview grid). */
export default function CvLoading() {
  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-6">
        {/* Tab nav pill */}
        <Skeleton className="h-11 w-80 max-w-full rounded-full" />

        <div className="space-y-4">
          {/* Save action row */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
          {/* ATS review strip */}
          <Skeleton className="h-24 rounded-2xl" />
          {/* Editor + preview */}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_768px]">
            <Skeleton className="h-[28rem] rounded-2xl" />
            <Skeleton className="h-[28rem] rounded-2xl" />
          </div>
        </div>
      </div>
    </Container>
  );
}
