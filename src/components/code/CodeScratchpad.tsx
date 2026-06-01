"use client";

import { AlertTriangle, Clock, Loader2, Play, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCodeScratch } from "./useCodeScratch";

/**
 * A "Run" scratchpad for a code answer: executes the current code in a sandboxed
 * worker and shows its console output. No test cases, no scoring, no hints —
 * just a way to sanity-check code (e.g. during a coding interview). The caller
 * supplies `getCode` since the editor is typically uncontrolled.
 */
export function CodeScratchpad({
  getCode,
  disabled = false,
}: {
  getCode: () => string;
  disabled?: boolean;
}) {
  const { state, run } = useCodeScratch();
  const running = state.status === "running";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted-foreground)]">
          Scratchpad — run your code to check it (not graded)
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run(getCode())}
          disabled={disabled || running}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run
        </Button>
      </div>

      {state.status !== "idle" && state.status !== "running" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          {state.status === "timeout" && (
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--destructive)]">
              <Clock className="h-4 w-4" /> Time limit exceeded — possible infinite
              loop.
            </p>
          )}
          {state.status === "error" && (
            <p className="flex items-start gap-2 text-sm font-medium text-[var(--destructive)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap font-mono text-xs">
                {state.error}
              </span>
            </p>
          )}
          {state.status === "done" && (
            <>
              <p className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" /> Console
                </span>
                <span className="font-normal normal-case">
                  {state.runtimeMs.toFixed(1)} ms
                </span>
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--foreground)]">
                {state.logs.length > 0
                  ? state.logs.join("\n")
                  : "Ran with no console output."}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
