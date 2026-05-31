"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
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
        An unexpected error occurred. You can try again, or head back to your
        dashboard.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <pre className="max-w-md overflow-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-left text-xs text-[var(--muted-foreground)]">
          {error.message}
        </pre>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
          Back to dashboard
        </Link>
      </div>
    </Container>
  );
}
