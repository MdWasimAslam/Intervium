import { Loader2 } from "lucide-react";

/**
 * Route-level loading UI shown while a segment resolves.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--primary)]" />
    </div>
  );
}
