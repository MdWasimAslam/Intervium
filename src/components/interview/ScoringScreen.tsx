"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { scoreSessionAction } from "@/lib/actions/interview";

/**
 * Shown when a finished session isn't scored yet. Kicks off scoring once,
 * then refreshes so the server re-renders the real results.
 */
export function ScoringScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    scoreSessionAction(sessionId).then((res) => {
      if (res.ok) router.refresh();
      else setError(res.error ?? "Scoring failed.");
    });
  }, [sessionId, router]);

  return (
    <Container className="max-w-md py-24">
      <Card>
        <CardContent
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 p-10 text-center"
        >
          {error ? (
            <>
              <p className="text-sm text-[var(--destructive)]">{error}</p>
              <Button
                onClick={() => {
                  started.current = false;
                  setError(undefined);
                  scoreSessionAction(sessionId).then((res) =>
                    res.ok ? router.refresh() : setError(res.error),
                  );
                }}
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
              <div>
                <p className="font-semibold">Scoring your answers…</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Our AI interviewer is reviewing your responses.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
