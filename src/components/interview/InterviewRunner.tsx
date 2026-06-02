"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/auth/FormError";
import { QuestionTimer } from "@/components/interview/QuestionTimer";
import { SaveStatus } from "@/components/interview/SaveStatus";
import { CodeEditor } from "@/components/interview/CodeEditor";
import { CodeScratchpad } from "@/components/code/CodeScratchpad";
import { QuestionPrompt } from "@/components/interview/QuestionPrompt";
import {
  readPersistedAnswers,
  useAnswerQueue,
} from "@/components/interview/useAnswerQueue";
import { completeSession } from "@/lib/actions/interview";

export interface RunnerQuestion {
  position: number;
  questionText: string;
  /** Answering modality. "coding" renders the code editor instead of a textarea. */
  type?: "text" | "coding";
  /** Editor language for coding questions (e.g. "javascript"). */
  language?: string | null;
}

interface Props {
  sessionId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<number, string>;
  timerEnabled: boolean;
  timerSeconds: number;
  startIndex: number;
}

/** Debounce before mirroring an in-progress answer to sessionStorage. */
const AUTOSAVE_DELAY_MS = 1500;
/** Code editor heights (px) for the normal and expanded layouts. */
const DEFAULT_EDITOR_PX = 360;
const EXPANDED_EDITOR_PX = 600;

/**
 * One-question-at-a-time text answering flow.
 *
 * The textarea/editor is uncontrolled (defaultValue + remount per question) so
 * the live DOM value is the single source of truth, read via a ref at submit.
 * In-progress answers are mirrored to sessionStorage (debounced) so a crash or
 * refresh mid-question doesn't lose unsubmitted work — the editor reseeds from
 * that draft on the next mount.
 *
 * Advancing is OPTIMISTIC: the answer is queued for a background save and the
 * UI moves to the next question immediately — typing is never blocked on the
 * network. The queue retries failed saves and warns before unload; the only
 * blocking moment is the final "Finish", which flushes the queue so scoring
 * always sees a complete session.
 */
export function InterviewRunner({
  sessionId,
  questions,
  initialAnswers,
  timerEnabled,
  timerSeconds,
  startIndex,
}: Props) {
  const router = useRouter();
  const total = questions.length;
  const [index, setIndex] = useState(startIndex);
  const [error, setError] = useState<string>();
  const [finishing, setFinishing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { enqueue, saveLocalDraft, flush, unsavedCount, hasFailure } =
    useAnswerQueue(sessionId);

  // In-progress answers left in sessionStorage by a prior crash/refresh, read
  // once so the editor can reseed from them (the rehydrate flush saves them too).
  const [drafts] = useState(() => readPersistedAnswers(sessionId));

  // Tracked in effects/handlers (never written during render).
  const submitRef = useRef<(auto: boolean) => void>(() => {});
  const startedAtRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Live code for a coding question (the editor is uncontrolled like the
  // textarea; this ref mirrors its current value for submit).
  const codeRef = useRef("");
  // Guards against advancing the same question twice (e.g. click + timer).
  const navigatedRef = useRef(false);
  // Synchronous guard so a last-question click + timer auto-expire can't both
  // pass the async `finishing` check and finish twice.
  const finishingRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = questions[index];
  const isLast = index === total - 1;
  const isCoding = q.type === "coding";
  const seededAnswer =
    drafts.get(q.position)?.answer ?? initialAnswers[q.position] ?? "";

  function elapsedSeconds(startedAt = startedAtRef.current): number {
    const raw = Math.round((Date.now() - startedAt) / 1000);
    const cap = timerEnabled ? timerSeconds : 100_000;
    return Math.max(0, Math.min(cap, raw));
  }

  function clearAutosave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
  }

  /** Debounced local persistence of the current answer (no server save). */
  function scheduleAutosave(text: string) {
    const position = q.position;
    const startedAt = startedAtRef.current;
    clearAutosave();
    autosaveTimer.current = setTimeout(() => {
      if (finishingRef.current) return;
      saveLocalDraft(position, { answer: text, timeTaken: elapsedSeconds(startedAt) });
    }, AUTOSAVE_DELAY_MS);
  }

  async function submit(auto: boolean, overrideText?: string) {
    if (finishingRef.current) return;
    if (!isLast && navigatedRef.current) return; // already advanced this one
    clearAutosave();

    const position = q.position;
    const text =
      overrideText ??
      (isCoding ? codeRef.current : (textareaRef.current?.value ?? ""));
    const timeTaken = auto ? timerSeconds : elapsedSeconds();

    setError(undefined);

    if (isLast) {
      // Final step: enqueue, then block just long enough to guarantee every
      // answer is saved before scoring runs.
      finishingRef.current = true;
      enqueue(position, { answer: text, timeTaken });
      setFinishing(true);
      const saved = await flush();
      if (!saved) {
        setError(
          "Some answers haven't saved yet — check your connection and tap Finish again.",
        );
        setFinishing(false);
        finishingRef.current = false; // allow a retry
        return;
      }
      const done = await completeSession({ sessionId });
      if (done?.error) {
        setError(done.error);
        setFinishing(false);
        finishingRef.current = false;
      }
      // Success → completeSession redirects.
      return;
    }

    // Not last: persist in the background and advance instantly.
    navigatedRef.current = true;
    enqueue(position, { answer: text, timeTaken });
    setIndex(index + 1);
  }

  /** Leave the interview — answers already persist, so just flush and go. */
  async function exitInterview() {
    if (finishing || exiting) return;
    clearAutosave();
    setExiting(true);
    const text = isCoding ? codeRef.current : (textareaRef.current?.value ?? "");
    // Don't persist an empty answer for an untouched question — that would mark
    // it answered and skip it on resume. Anything typed was already autosaved.
    if (text.trim()) {
      enqueue(q.position, { answer: text, timeTaken: elapsedSeconds() });
    }
    await flush();
    router.push("/dashboard");
  }

  // Keep submitRef current for the timer's onExpire.
  useEffect(() => {
    submitRef.current = submit;
  });

  // Reset the per-question stopwatch + navigation guard on question change.
  // Seed the code ref from the saved answer or a recovered draft (the editor
  // remounts per question). Cancel any pending autosave on leaving a question.
  useEffect(() => {
    startedAtRef.current = Date.now();
    navigatedRef.current = false;
    const position = questions[index].position;
    codeRef.current =
      drafts.get(position)?.answer ?? initialAnswers[position] ?? "";
    return clearAutosave;
  }, [index, initialAnswers, questions, drafts]);

  return (
    <Container
      className={cn("py-10", expanded && isCoding ? "max-w-5xl" : "max-w-2xl")}
    >
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={exitInterview}
          disabled={finishing || exiting}
          className="text-[var(--muted-foreground)]"
        >
          {exiting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Save &amp; exit
        </Button>
      </div>

      {/* Progress */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Question {index + 1} of {total}
          </span>
          <span className="text-[var(--muted-foreground)]">
            {Math.round(((index + 1) / total) * 100)}% complete
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {timerEnabled && (
        <div className="mb-4">
          <QuestionTimer
            key={index}
            seconds={timerSeconds}
            onExpire={() => submitRef.current(true)}
          />
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <Card>
            <CardContent className="space-y-4 p-6">
              <QuestionPrompt
                text={q.questionText}
                className="text-lg font-semibold leading-relaxed"
              />
              {isCoding ? (
                <CodeEditor
                  key={q.position}
                  defaultValue={seededAnswer}
                  defaultLanguage={q.language ?? "javascript"}
                  onChange={(value) => {
                    codeRef.current = value;
                    scheduleAutosave(value);
                  }}
                  disabled={finishing}
                  expanded={expanded}
                  onToggleExpanded={() => setExpanded((v) => !v)}
                  height={expanded ? EXPANDED_EDITOR_PX : DEFAULT_EDITOR_PX}
                />
              ) : (
                <Textarea
                  key={q.position}
                  ref={textareaRef}
                  rows={8}
                  defaultValue={seededAnswer}
                  onChange={(e) => scheduleAutosave(e.target.value)}
                  placeholder="Type your answer here…"
                  autoFocus
                  disabled={finishing}
                />
              )}

              {/* JS-only scratchpad: run code to check it (not graded). The
                  worker executes JavaScript, so it's hidden for other langs. */}
              {isCoding && (!q.language || q.language === "javascript") && (
                <CodeScratchpad
                  key={`scratch-${q.position}`}
                  getCode={() => codeRef.current}
                  disabled={finishing}
                />
              )}

              {error && <FormError message={error} />}

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => submit(false, "")}
                  disabled={finishing}
                >
                  Skip
                </Button>

                {isLast ? (
                  <Button
                    type="button"
                    onClick={() => submit(false)}
                    disabled={finishing}
                  >
                    {finishing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    {finishing ? "Finishing…" : "Finish"}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => submit(false)}>
                    Next
                    <ArrowRight />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Non-blocking save status — never gates answering. */}
      <SaveStatus unsavedCount={unsavedCount} hasFailure={hasFailure} />
    </Container>
  );
}
