import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProgressScore, getWeakestSpecialization } from "@/lib/progress";
import { tierFromPoints } from "@/lib/progress-tiers";
import { ProgressShieldCard } from "@/components/dashboard/ProgressShieldCard";

/**
 * Server wrapper for the Progress Shield card. Fetches the read-time score
 * (userId-scoped, cached) and the cheap "weakest area" hint, derives the tier
 * with the pure engine, then hands serializable props to the client card.
 *
 * Rendered inside a <Suspense> on the dashboard so it streams in behind
 * {@link ProgressShieldSkeleton} without blocking the rest of the page.
 */
export async function ProgressShieldSection({ userId }: { userId: string }) {
  const [score, weakestArea] = await Promise.all([
    getProgressScore(userId),
    getWeakestSpecialization(userId),
  ]);
  const tier = tierFromPoints(score.total);

  return (
    <ProgressShieldCard score={score} tier={tier} weakestArea={weakestArea} />
  );
}

/** Loading placeholder matching the card's footprint. */
export function ProgressShieldSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col items-center gap-4 p-6 text-center">
        <Skeleton className="h-[188px] w-[188px] rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="grid w-full grid-cols-3 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mt-auto h-4 w-44" />
      </CardContent>
    </Card>
  );
}
