import { Crosshair, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PracticeAreaButton } from "@/components/dashboard/PracticeAreaButton";
import type { WeakArea } from "@/lib/insights";

/**
 * Weakest tech-stack/focus-area, with a one-click "Practice this area" that
 * starts an interview pre-configured to it. Shows a gentle "keep going" state
 * until there's enough data to name a weak area.
 */
export function WeakAreaCard({
  weakest,
  ranked,
}: {
  weakest: WeakArea | null;
  ranked: WeakArea[];
}) {
  const alsoWeak = ranked.slice(1);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <TrendingDown className="h-4 w-4 text-[var(--primary)]" />
        <CardTitle className="text-base">Your weakest area</CardTitle>
      </CardHeader>

      {weakest ? (
        <CardContent className="flex flex-1 flex-col gap-4">
          <div>
            <p className="text-xl font-semibold tracking-tight">
              {weakest.focusName}
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {weakest.techName} · {weakest.difficulty}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">
                avg{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {weakest.avgScore.toFixed(1)}/10
                </span>{" "}
                across {weakest.count} question
                {weakest.count === 1 ? "" : "s"}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {weakest.avgPct}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[var(--muted)]"
              role="img"
              aria-label={`Average ${weakest.avgPct}% in ${weakest.focusName}`}
            >
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.max(4, weakest.avgPct)}%` }}
              />
            </div>
          </div>

          {alsoWeak.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {alsoWeak.map((a) => (
                <li
                  key={`${a.techStackId}-${a.focusAreaId}`}
                  className="flex items-center justify-between gap-3 text-[var(--muted-foreground)]"
                >
                  <span className="truncate">
                    {a.focusName} · {a.techName}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {a.avgScore.toFixed(1)}/10
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-1">
            <PracticeAreaButton
              config={{
                jobRoleId: weakest.jobRoleId,
                techStackId: weakest.techStackId,
                focusAreaId: weakest.focusAreaId,
                difficulty: weakest.difficulty,
              }}
            />
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
            <Crosshair className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Weak areas appear soon</p>
          <p className="mx-auto max-w-xs text-sm text-[var(--muted-foreground)]">
            Answer a few more questions in an area and we&apos;ll pinpoint where
            to focus next.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
