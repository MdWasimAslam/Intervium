import { LoadingState } from "@/components/ui/LoadingState";

/**
 * Route-level loading UI.
 * Next.js shows this automatically while a route segment's data resolves.
 */
export default function Loading() {
  return <LoadingState message="Loading page…" />;
}
