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

      {/* Five sections (Avatar, Identity, Role, Skills, CV) of varying height. */}
      <div className="space-y-5">
        {["h-56", "h-36", "h-52", "h-56", "h-44"].map((h, i) => (
          <Skeleton key={i} className={`${h} rounded-2xl`} />
        ))}
      </div>
    </Container>
  );
}
