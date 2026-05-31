"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/auth/FormError";
import { QuestionTimer } from "@/components/interview/QuestionTimer";
import { SaveStatus } from "@/components/interview/SaveStatus";
import { CodeEditor } from "@/components/interview/CodeEditor";
import { QuestionPrompt } from "@/components/interview/QuestionPrompt";
import { useAnswerQueue } from "@/components/interview/useAnswerQueue";
import { completeSession } from "@/lib/actions/interview";

export interface RunnerQuestion {
  position: number;
  questionText: string;
  /** Answering modality. "coding" renders the code editor instead of a textarea. */
  type?: "text" | "voice" | "either" | "coding";
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

/**
 * One-question-at-a-time text answering flow.
 *
 * The textarea is uncontrolled (defaultValue + remount per question) so the
 * live DOM value is the single source of truth, read via a ref at submit.
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
  const total = questions.length;
  const [index, setIndex] = useState(startIndex);
  const [error, setError] = useState<string>();
  const [finishing, setFinishing] = useState(false);

  const { enqueue, flush, unsavedCount, hasFailure } = useAnswerQueue(sessionId);

  // Tracked in effects/handlers (never written during render).
  const submitRef = useRef<(auto: boolean) => void>(() => {});
  const startedAtRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Live code for a coding question (the editor is uncontrolled like the
  // textarea; this ref mirrors its current value for submit).
  const codeRef = useRef("");
  // Guards against advancing the same question twice (e.g. click + timer).
  const navigatedRef = useRef(false);

  const q = questions[index];
  const isLast = index === total - 1;
  const isCoding = q.type === "coding";

  function elapsedSeconds(): number {
    const raw = Math.round((Date.now() - startedAtRef.current) / 1000);
    const cap = timerEnabled ? timerSeconds : 100_000;
    return Math.max(0, Math.min(cap, raw));
  }

  async function submit(auto: boolean, overrideText?: string) {
    if (finishing) return;
    if (!isLast && navigatedRef.current) return; // already advanced this one

    const position = q.position;
    const text =
      overrideText ??
      (isCoding ? codeRef.current : (textareaRef.current?.value ?? ""));
    const timeTaken = auto ? timerSeconds : elapsedSeconds();

    setError(undefined);

    if (isLast) {
      // Final step: enqueue, then block just long enough to guarantee every
      // answer is saved before scoring runs.
      enqueue(position, { answer: text, timeTaken });
      setFinishing(true);
      const saved = await flush();
      if (!saved) {
        setError(
          "Some answers haven't saved yet — check your connection and tap Finish again.",
        );
        setFinishing(false);
        return;
      }
      const done = await completeSession({ sessionId });
      if (done?.error) {
        setError(done.error);
        setFinishing(false);
      }
      // Success → completeSession redirects.
      return;
    }

    // Not last: persist in the background and advance instantly.
    navigatedRef.current = true;
    enqueue(position, { answer: text, timeTaken });
    setIndex(index + 1);
  }

  // Keep submitRef current for the timer's onExpire.
  useEffect(() => {
    submitRef.current = submit;
  });

  // Reset the per-question stopwatch + navigation guard on question change.
  // Seed the code ref from the saved answer (the editor remounts per question).
  useEffect(() => {
    startedAtRef.current = Date.now();
    navigatedRef.current = false;
    codeRef.current = initialAnswers[questions[index].position] ?? "";
  }, [index, initialAnswers, questions]);

  return (
    <Container className="max-w-2xl py-10">
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
                  defaultValue={initialAnswers[q.position] ?? ""}
                  defaultLanguage={q.language ?? "javascript"}
                  onChange={(value) => {
                    codeRef.current = value;
                  }}
                  disabled={finishing}
                />
              ) : (
                <Textarea
                  key={q.position}
                  ref={textareaRef}
                  rows={8}
                  defaultValue={initialAnswers[q.position] ?? ""}
                  placeholder="Type your answer here…"
                  autoFocus
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
