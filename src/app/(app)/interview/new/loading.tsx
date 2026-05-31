import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewInterviewLoading() {
  return (
    <Container className="py-10">
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[520px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </Container>
  );
}
