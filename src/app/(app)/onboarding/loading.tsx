import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the onboarding wizard (progress bar + form card). */
export default function OnboardingLoading() {
  return (
    <Container className="max-w-xl py-10 sm:py-12">
      {/* Step progress */}
      <Skeleton className="h-2 w-full rounded-full" />

      <div className="mt-8 space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="mt-6 h-72 rounded-2xl" />

      <div className="mt-6 flex justify-between">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
    </Container>
  );
}
