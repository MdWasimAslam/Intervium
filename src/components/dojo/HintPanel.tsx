"use client";

import { useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDojoHintAction } from "@/lib/actions/dojo";

/**
 * Progressive AI hints for a problem. Each request escalates one level
 * (nudge → technique → plain-English outline), up to 3. Never returns code.
 * Calls `onHintUsed` so the solve view can record how much help was used.
 */
export function HintPanel({
  questionId,
  code,
  onHintUsed,
}: {
  questionId: string;
  code: string;
  onHintUsed?: () => void;
}) {
  const [hints, setHints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const used = hints.length;
  const exhausted = used >= 3;

  async function getHint() {
    setLoading(true);
    setError(undefined);
    const level = (used + 1) as 1 | 2 | 3;
    const res = await getDojoHintAction({ questionId, code, level });
    setLoading(false);
    if (res.ok) {
      setHints((h) => [...h, res.data.hint]);
      onHintUsed?.();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Hints
        </span>
        {!exhausted && (
          <Button variant="outline" size="sm" onClick={getHint} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            {used === 0 ? "Get a hint" : "Next hint"}
          </Button>
        )}
      </div>

      {used === 0 && !error && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Stuck? Get a nudge — hints guide you toward the idea without giving the
          solution.
        </p>
      )}
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {used > 0 && (
        <ol className="space-y-2">
          {hints.map((h, i) => (
            <li
              key={i}
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Hint {i + 1}
              </span>
              <p className="mt-1 leading-relaxed">{h}</p>
            </li>
          ))}
        </ol>
      )}

      {exhausted && (
        <p className="text-xs text-[var(--muted-foreground)]">
          That&apos;s all 3 hints — you&apos;ve got this.
        </p>
      )}
    </div>
  );
}
