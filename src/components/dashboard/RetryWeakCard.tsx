import { CheckCircle2, Dumbbell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RetryWeakButton } from "@/components/dashboard/RetryWeakButton";
import type { RetryCandidates } from "@/lib/insights";

/**
 * "Retry your weakest answers" — spaced-repetition over the specific questions
 * the user scored lowest on. Retries are fresh attempts, so improving drops a
 * question off this list. Celebrates the empty (all-strong) state.
 */
export function RetryWeakCard({ retry }: { retry: RetryCandidates }) {
  const has = retry.count > 0;
  const shown = Math.min(retry.count, 10);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Dumbbell className="h-4 w-4 text-[var(--primary)]" />
        <CardTitle className="text-base">Retry your weakest answers</CardTitle>
      </CardHeader>

      {has ? (
        <CardContent className="flex flex-1 flex-col gap-4">
          <div>
            <p className="text-xl font-semibold tracking-tight">
              {retry.count} answer{retry.count === 1 ? "" : "s"} to sharpen
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Questions you scored below 60% (currently averaging{" "}
              <span className="font-semibold text-[var(--foreground)] tabular-nums">
                {retry.avgPct}%
              </span>
              ). We&apos;ll rebuild a session from the{" "}
              {shown === retry.count ? "" : `${shown} `}weakest — a fresh
              attempt so you can see the jump.
            </p>
          </div>

          <div className="mt-auto pt-1">
            <RetryWeakButton count={shown} />
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">No weak answers right now</p>
          <p className="mx-auto max-w-xs text-sm text-[var(--muted-foreground)]">
            Every question you&apos;ve answered is scoring 60% or above — nice
            work. Keep it up.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
