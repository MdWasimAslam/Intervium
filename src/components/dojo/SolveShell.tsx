"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Code2,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Markdown } from "@/components/ui/markdown";
import { SplitPane } from "@/components/ui/SplitPane";
import { CodeEditor } from "@/components/code/CodeEditor";
import { ResultsPanel } from "@/components/code/ResultsPanel";
import { useJsRunner } from "@/components/code/useJsRunner";
import { useCodeScratch } from "@/components/code/useCodeScratch";
import { useCoarsePointer } from "@/components/code/useCoarsePointer";
import { useFullscreen } from "@/components/code/useFullscreen";
import { readDraft, useEditorDraft } from "@/components/code/useEditorDraft";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import {
  deletePersonalDojoQuestion,
  reviewDojoSolutionAction,
  saveDojoAttempt,
} from "@/lib/actions/dojo";
import type { DojoQuestionDetail } from "@/lib/dojo/types";
import type { DojoReview } from "@/lib/groq";
import { DifficultyBadge } from "./DifficultyBadge";
import { HintPanel } from "./HintPanel";
import { ConfidenceRating } from "./ConfidenceRating";

/**
 * Solve view. **Run** executes in the console (no assertions); **Submit** runs
 * the test cases, saves the attempt, and unlocks the rating + AI review. The
 * editor + results live in a resizable, fullscreen-able pane; in-progress code
 * autosaves to localStorage.
 */
export function SolveShell({
  question,
  fresh = false,
  onBack,
  onSolved,
  onScratchpad,
  onDeleted,
}: {
  question: DojoQuestionDetail;
  /** Start on a clean slate (starter code), ignoring any saved draft or previous
   * submission — used by the random "practice" quick-start. The saved draft is
   * left intact so resuming from the problem list still restores it. */
  fresh?: boolean;
  onBack?: () => void;
  /** Called once a problem first transitions to solved (after the attempt is
   * persisted) so the parent can refresh the problem list. */
  onSolved?: () => void;
  /** Leave the problem and return to the free scratchpad, if available. */
  onScratchpad?: () => void;
  /** Called after this problem is deleted so the parent can drop it from view. */
  onDeleted?: () => void;
}) {
  const draftKey = `dojo:draft:${question.id}`;
  const [code, setCode] = useState(() =>
    fresh
      ? question.starterCode
      : (readDraft(draftKey) ??
        question.lastAttemptCode ??
        question.starterCode),
  );
  const [solved, setSolved] = useState(question.solved);
  const [hintsUsed, setHintsUsed] = useState(0);
  // Hints already attributed to a prior submit, so each attempt records only
  // the hints consulted for it (not the running session total).
  const hintsAtLastSubmit = useRef(0);
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"tests" | "console">("tests");
  const {
    fullscreen,
    toggle: toggleFullscreen,
    layoutSignal,
    bumpLayout,
  } = useFullscreen();
  const [confirmReset, setConfirmReset] = useState(false);

  const [lastSubmit, setLastSubmit] = useState<{
    code: string;
    summary: string;
  } | null>(null);
  const [review, setReview] = useState<DojoReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string>();

  const tests = useJsRunner();
  const scratch = useCodeScratch();
  const draft = useEditorDraft(draftKey, question.starterCode);
  const coarse = useCoarsePointer();

  const testRunning = tests.state.status === "running";
  const runRunning = scratch.state.status === "running";
  const busy = testRunning || runRunning;

  function changeCode(v: string) {
    setCode(v);
    draft.save(v);
  }

  function handleRun() {
    tests.reset(); // cancel any in-flight submit
    setTab("console");
    scratch.run(code);
  }

  async function handleSubmit() {
    scratch.cancel(); // cancel any in-flight run
    setTab("tests");
    setSaveError(undefined);
    const submitted = code;
    const outcome = await tests.run(
      submitted,
      question.fnName,
      question.testCases,
    );
    if (outcome.kind === "cancelled") return;

    const passedAll =
      outcome.kind === "done" &&
      outcome.total > 0 &&
      outcome.passed === outcome.total;
    const summary =
      outcome.kind === "done"
        ? `${outcome.passed}/${outcome.total} test cases passed`
        : outcome.kind === "timeout"
          ? "Time limit exceeded (likely an infinite loop)."
          : `Runtime/syntax error: ${outcome.error}`;

    // Test results reflect this run regardless of whether the save succeeds.
    setLastSubmit({ code: submitted, summary });
    setReview(null);
    setReviewError(undefined);

    const newlySolved = passedAll && !solved;
    // Record only the hints consulted since the last submit, not the total.
    const hintsThisAttempt = Math.max(0, hintsUsed - hintsAtLastSubmit.current);

    setSaving(true);
    const res = await saveDojoAttempt({
      questionId: question.id,
      code: submitted,
      status: passedAll ? "passed" : "failed",
      testsPassed: outcome.kind === "done" ? outcome.passed : 0,
      testsTotal:
        outcome.kind === "done" ? outcome.total : question.testCases.length,
      runtimeMs:
        outcome.kind === "done" ? Math.round(outcome.runtimeMs) : undefined,
      hintsUsed: hintsThisAttempt,
    });
    setSaving(false);

    if (!res.ok) {
      // Keep the draft so the work isn't lost, and surface the failure.
      setSaveError(
        res.error ?? "Could not save your attempt. Please try again.",
      );
      return;
    }

    hintsAtLastSubmit.current = hintsUsed;
    draft.clear(); // the submitted code is now the canonical last attempt
    if (passedAll) setSolved(true);
    // On the first solve, ask the parent to refresh so the problem list reflects
    // the new "solved" status without a hard reload.
    if (newlySolved && res.data.solved) onSolved?.();
  }

  function handleStop() {
    if (testRunning) tests.reset();
    if (runRunning) scratch.cancel();
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    setCode(question.starterCode);
    draft.clear();
    tests.reset();
    scratch.cancel();
    // Drop the previous submission so AI review can't act on reset-away code.
    setLastSubmit(null);
    setReview(null);
    setReviewError(undefined);
    setSaveError(undefined);
  }

  function handleReview() {
    if (!lastSubmit) return;
    setReviewing(true);
    setReviewError(undefined);
    void reviewDojoSolutionAction({
      questionId: question.id,
      code: lastSubmit.code,
      testsSummary: lastSubmit.summary,
    }).then((res) => {
      setReviewing(false);
      if (res.ok) setReview(res.data);
      else setReviewError(res.error);
    });
  }

  const workbench = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">
          JavaScript
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {busy && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            >
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            {confirmReset ? "Confirm reset" : "Reset"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={busy || saving}
          >
            {runRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={busy || saving}>
            {testRunning || saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Submit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {saveError && (
        <p className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {saveError}
        </p>
      )}

      <SplitPane
        storageKey="dojo-editor"
        disabled={coarse}
        onResize={bumpLayout}
        top={
          <div className="h-full overflow-hidden rounded-xl border border-[var(--border)]">
            <CodeEditor
              value={code}
              onChange={changeCode}
              onRun={handleRun}
              onSubmit={handleSubmit}
              layoutSignal={layoutSignal}
            />
          </div>
        }
        bottom={
          <div className="space-y-3 pt-3">
            <ResultsPanel
              tab={tab}
              onTab={setTab}
              testState={tests.state}
              scratchState={scratch.state}
              review={review}
              reviewing={reviewing}
              reviewError={reviewError}
              onReview={handleReview}
              canReview={lastSubmit !== null}
            />
            {solved && <ConfidenceRating questionId={question.id} />}
          </div>
        }
      />
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Problem */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" /> All problems
            </button>
          ) : (
            <Link
              href="/dojo"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" /> All problems
            </Link>
          )}
          {onScratchpad && (
            <button
              type="button"
              onClick={onScratchpad}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <Code2 className="h-4 w-4" /> Scratchpad
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">{question.title}</h1>
          <DifficultyBadge difficulty={question.difficulty} />
          {solved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Solved
            </span>
          )}
          {question.isMine && (
            <span className="ml-auto">
              <ConfirmDelete
                action={() => deletePersonalDojoQuestion({ id: question.id })}
                title="Delete this problem?"
                description="This permanently removes your problem. Problems with practice history can't be deleted."
                onSuccess={onDeleted ?? onBack}
              />
            </span>
          )}
        </div>

        {question.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {question.topics.map((t) => (
              <Chip key={t.slug} className="text-xs">
                {t.name}
              </Chip>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <Markdown>{question.prompt}</Markdown>
        </div>

        <HintPanel
          questionId={question.id}
          code={code}
          onHintUsed={() => setHintsUsed((n) => n + 1)}
        />
      </div>

      {/* Editor + runner — overlays as fullscreen without remounting Monaco.
          In fullscreen the problem column is hidden behind the overlay, so the
          prompt rides along in a collapsible panel up top. */}
      <div
        className={cn(
          fullscreen &&
            "fixed inset-0 z-50 overflow-auto bg-[var(--background)] p-4 sm:p-6",
        )}
      >
        {fullscreen && (
          <details
            open
            className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
          >
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">
              {question.title}
            </summary>
            <div className="max-h-48 overflow-auto border-t border-[var(--border)] px-4 py-3">
              <Markdown>{question.prompt}</Markdown>
            </div>
          </details>
        )}
        {workbench}
      </div>
    </div>
  );
}
