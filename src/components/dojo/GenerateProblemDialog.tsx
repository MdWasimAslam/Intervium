"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { Markdown } from "@/components/ui/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormError } from "@/components/auth/FormError";
import { TestResults } from "@/components/code/TestResults";
import { useJsRunner } from "@/components/code/useJsRunner";
import { createPersonalDojoQuestion } from "@/lib/actions/dojo";
import type { DojoDifficulty } from "@/lib/dojo/types";
import { DifficultyBadge } from "./DifficultyBadge";
import { useDojoDraft } from "./useDojoDraft";

const DIFFICULTIES: DojoDifficulty[] = ["easy", "medium", "hard"];

/**
 * AI "Add problem" flow: describe a problem (or just pick a topic + difficulty),
 * the AI drafts one with a reference solution, we verify that solution against
 * the generated test cases in the sandbox, and only a verified draft can be
 * saved as the user's own private problem.
 */
export function GenerateProblemDialog({
  trigger,
  topicSuggestions = [],
  onCreated,
}: {
  trigger: React.ReactNode;
  topicSuggestions?: string[];
  onCreated?: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<DojoDifficulty>("easy");
  const [promptText, setPromptText] = useState("");

  const {
    draft,
    generating,
    error: genError,
    generate,
    reset,
  } = useDojoDraft();
  const { state: runState, run, reset: resetRun } = useJsRunner();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [saving, startSave] = useTransition();
  // Set when the dialog closes mid-generate so the async flow bails instead of
  // continuing (which would burn another AI call and update closed-dialog state).
  const aborted = useRef(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      aborted.current = false;
    } else {
      aborted.current = true;
      reset();
      resetRun();
      setVerified(false);
      setVerifying(false);
      setSaveError(undefined);
    }
  }

  async function doGenerate(isRetry = false) {
    setVerified(false);
    setSaveError(undefined);
    const d = await generate({
      topic: topic.trim() || undefined,
      difficulty,
      prompt: promptText.trim() || undefined,
    });
    if (aborted.current || !d) return;

    setVerifying(true);
    const outcome = await run(d.referenceSolution, d.fnName, d.testCases);
    if (aborted.current) return;
    setVerifying(false);

    const allPass =
      outcome.kind === "done" &&
      outcome.total > 0 &&
      outcome.passed === outcome.total;
    if (allPass) setVerified(true);
    else if (!isRetry)
      await doGenerate(true); // one silent retry
    else setVerified(false);
  }

  function save() {
    if (!draft || !verified) return;
    setSaveError(undefined);
    startSave(async () => {
      const res = await createPersonalDojoQuestion({
        title: draft.title,
        prompt: draft.prompt,
        difficulty: draft.difficulty,
        fnName: draft.fnName,
        starterCode: draft.starterCode,
        testCases: draft.testCases,
        topics: draft.topics,
      });
      if (res.ok) {
        onOpenChange(false);
        onCreated?.(res.data.slug);
      } else {
        setSaveError(res.error);
      }
    });
  }

  const busy = generating || verifying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--primary)]" /> Generate a
            problem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Topic (optional)
              </span>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Arrays, Hash Map…"
                list="dojo-gen-topics"
              />
              <datalist id="dojo-gen-topics">
                {topicSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Difficulty
              </span>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as DojoDifficulty)}
              >
                <SelectTrigger aria-label="Difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Describe it (optional)
            </span>
            <Textarea
              rows={2}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. find the longest substring without repeating characters"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => void doGenerate()}
            disabled={busy}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating
              ? "Generating…"
              : verifying
                ? "Verifying tests…"
                : draft
                  ? "Regenerate"
                  : "Generate"}
          </Button>

          {genError && <FormError message={genError} />}

          {draft && !generating && (
            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{draft.title}</span>
                <DifficultyBadge difficulty={draft.difficulty} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {draft.topics.map((t) => (
                  <Chip key={t} className="text-xs">
                    {t}
                  </Chip>
                ))}
              </div>
              <div className="max-h-32 overflow-auto text-[var(--muted-foreground)]">
                <Markdown>{draft.prompt}</Markdown>
              </div>

              {verifying ? (
                <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying the
                  test cases…
                </p>
              ) : verified ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" /> Verified — the reference
                  solution passes all {draft.testCases.length} test cases.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--destructive)]">
                    The generated solution didn&apos;t pass its own tests.
                    Regenerate to try again.
                  </p>
                  <TestResults state={runState} />
                </div>
              )}
            </div>
          )}

          {saveError && <FormError message={saveError} />}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <LoadingButton
            loading={saving}
            loadingText="Saving…"
            disabled={!verified || busy}
            onClick={save}
          >
            Save to my problems
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
