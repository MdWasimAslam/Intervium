"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Route-level error boundary.
 * Must be a Client Component. Receives the thrown error and a `reset`
 * callback that re-renders the segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in a real app.
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      message={error.message || "An unexpected error occurred."}
      onRetry={reset}
    />
  );
}
