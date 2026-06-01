"use client";

import { AlertTriangle, Check, Clock, Loader2, Terminal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseResult, RunState } from "./types";

function show(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Renders the runner's state: idle hint, spinner, per-case results, or errors. */
export function TestResults({ state }: { state: RunState }) {
  if (state.status === "idle") {
    return (
      <p className="p-4 text-sm text-[var(--muted-foreground)]">
        Run your code to see test results.
      </p>
    );
  }

  if (state.status === "running") {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Running…
      </p>
    );
  }

  if (state.status === "timeout") {
    return (
      <div className="space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--destructive)]">
          <Clock className="h-4 w-4" /> Time limit exceeded — possible infinite
          loop.
        </p>
        <ConsoleOutput logs={state.logs} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 p-4">
        <p className="flex items-start gap-2 text-sm font-medium text-[var(--destructive)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap font-mono text-xs">
            {state.error}
          </span>
        </p>
        <ConsoleOutput logs={state.logs} />
      </div>
    );
  }

  // done
  const allPassed = state.passed === state.total && state.total > 0;
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            allPassed
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-[var(--destructive)]/15 text-[var(--destructive)]",
          )}
        >
          {allPassed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {state.passed}/{state.total} passed
        </span>
        <span className="text-xs text-[var(--muted-foreground)]">
          {state.runtimeMs.toFixed(1)} ms
        </span>
      </div>

      <ul className="space-y-2">
        {state.results.map((r, i) => (
          <CaseRow key={i} index={i} result={r} />
        ))}
      </ul>

      <ConsoleOutput logs={state.logs} />
    </div>
  );
}

function CaseRow({ index, result }: { index: number; result: CaseResult }) {
  return (
    <li
      className={cn(
        "rounded-lg border p-3 text-sm",
        result.passed
          ? "border-emerald-500/20 bg-emerald-500/[0.06]"
          : "border-[var(--destructive)]/20 bg-[var(--destructive)]/[0.06]",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {result.passed ? (
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <X className="h-4 w-4 text-[var(--destructive)]" />
        )}
        Case {index + 1}
        {result.hidden && (
          <span className="text-xs font-normal text-[var(--muted-foreground)]">
            (hidden)
          </span>
        )}
      </div>

      {!result.hidden && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
          <dt className="text-[var(--muted-foreground)]">input</dt>
          <dd className="break-all">{result.input.map(show).join(", ")}</dd>
          <dt className="text-[var(--muted-foreground)]">expected</dt>
          <dd className="break-all">{show(result.expected)}</dd>
          {result.error ? (
            <>
              <dt className="text-[var(--destructive)]">threw</dt>
              <dd className="break-all text-[var(--destructive)]">{result.error}</dd>
            </>
          ) : (
            <>
              <dt className="text-[var(--muted-foreground)]">got</dt>
              <dd
                className={cn(
                  "break-all",
                  !result.passed && "text-[var(--destructive)]",
                )}
              >
                {show(result.actual)}
              </dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}

function ConsoleOutput({ logs }: { logs: string[] }) {
  if (logs.length === 0) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        <Terminal className="h-3.5 w-3.5" /> Console
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--secondary)] p-3 font-mono text-xs">
        {logs.join("\n")}
      </pre>
    </div>
  );
}
