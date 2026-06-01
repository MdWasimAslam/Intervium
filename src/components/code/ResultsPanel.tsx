"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Loader2,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TestResults } from "./TestResults";
import type { RunState, ScratchState } from "./types";
import type { DojoReview } from "@/lib/groq";

const VERDICT: Record<
  DojoReview["verdict"],
  { label: string; cls: string; icon: typeof Check }
> = {
  correct: {
    label: "Correct",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    icon: Check,
  },
  partial: {
    label: "Partial",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  incorrect: {
    label: "Incorrect",
    cls: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
    icon: X,
  },
};

interface Props {
  tab: "tests" | "console";
  onTab: (t: "tests" | "console") => void;
  testState: RunState;
  scratchState: ScratchState;
  review: DojoReview | null;
  reviewing: boolean;
  reviewError?: string;
  onReview: () => void;
  canReview: boolean;
}

/** Tabbed results: test cases (Submit) + AI review, and console output (Run). */
export function ResultsPanel({
  tab,
  onTab,
  testState,
  scratchState,
  review,
  reviewing,
  reviewError,
  onReview,
  canReview,
}: Props) {
  function copyActive() {
    const text =
      tab === "console" ? scratchText(scratchState) : testText(testState);
    void navigator.clipboard?.writeText(text);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-2 py-1.5">
        <div className="inline-flex gap-1">
          <TabBtn active={tab === "tests"} onClick={() => onTab("tests")}>
            Tests
          </TabBtn>
          <TabBtn active={tab === "console"} onClick={() => onTab("console")}>
            Console
          </TabBtn>
        </div>
        <Button variant="ghost" size="sm" onClick={copyActive}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "tests" ? (
          <>
            <TestResults state={testState} />
            <ReviewSection
              review={review}
              reviewing={reviewing}
              reviewError={reviewError}
              onReview={onReview}
              canReview={canReview}
            />
          </>
        ) : (
          <ScratchConsole state={scratchState} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--muted)] text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}

function ReviewSection({
  review,
  reviewing,
  reviewError,
  onReview,
  canReview,
}: {
  review: DojoReview | null;
  reviewing: boolean;
  reviewError?: string;
  onReview: () => void;
  canReview: boolean;
}) {
  if (!canReview) return null;
  const v = review ? VERDICT[review.verdict] : null;

  return (
    <div className="space-y-2 border-t border-[var(--border)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" /> AI review
        </span>
        <Button variant="outline" size="sm" onClick={onReview} disabled={reviewing}>
          {reviewing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {review ? "Review again" : "Ask AI to review"}
        </Button>
      </div>

      {reviewError && <p className="text-sm text-[var(--destructive)]">{reviewError}</p>}

      {review && v && (
        <div className="space-y-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              v.cls,
            )}
          >
            <v.icon className="h-3.5 w-3.5" /> {v.label}
          </span>
          <p className="text-sm leading-relaxed">{review.summary}</p>
          {review.suggestions.length > 0 && (
            <ul className="space-y-1.5">
              {review.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-0.5 text-[var(--primary)]">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ScratchConsole({ state }: { state: ScratchState }) {
  if (state.status === "idle")
    return (
      <p className="p-4 text-sm text-[var(--muted-foreground)]">
        Run your code (Cmd/Ctrl+Enter) to see console output here.
      </p>
    );
  if (state.status === "running")
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Running…
      </p>
    );
  if (state.status === "timeout")
    return (
      <p className="flex items-center gap-2 p-4 text-sm font-medium text-[var(--destructive)]">
        <Clock className="h-4 w-4" /> Time limit exceeded — possible infinite loop.
      </p>
    );
  if (state.status === "error")
    return (
      <div className="space-y-2 p-4">
        <p className="flex items-start gap-2 text-sm font-medium text-[var(--destructive)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap font-mono text-xs">{state.error}</span>
        </p>
        {state.logs.length > 0 && <LogBlock logs={state.logs} />}
      </div>
    );
  // done
  return (
    <div className="space-y-1 p-4">
      <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5" /> Console
        </span>
        <span className="font-normal normal-case">{state.runtimeMs.toFixed(1)} ms</span>
      </p>
      {state.logs.length > 0 ? (
        <LogBlock logs={state.logs} />
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">Ran with no console output.</p>
      )}
    </div>
  );
}

function LogBlock({ logs }: { logs: string[] }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-3 font-mono text-xs">
      {logs.join("\n")}
    </pre>
  );
}

/* --- copy helpers --------------------------------------------------------- */

function scratchText(state: ScratchState): string {
  if (state.status === "done" || state.status === "error" || state.status === "timeout") {
    const logs = "logs" in state ? state.logs : [];
    const head =
      state.status === "error"
        ? `Error: ${state.error}`
        : state.status === "timeout"
          ? "Time limit exceeded."
          : "";
    return [head, ...logs].filter(Boolean).join("\n");
  }
  return "";
}

function testText(state: RunState): string {
  if (state.status !== "done") return state.status;
  const lines = [`${state.passed}/${state.total} passed`];
  state.results.forEach((r, i) => {
    lines.push(
      `Case ${i + 1}: ${r.passed ? "PASS" : "FAIL"}${r.error ? ` (threw: ${r.error})` : ""}`,
    );
  });
  return lines.join("\n");
}
