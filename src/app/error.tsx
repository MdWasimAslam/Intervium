"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/Container";

/**
 * Route-level error boundary (must be a Client Component).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-[var(--muted-foreground)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </Container>
  );
}
