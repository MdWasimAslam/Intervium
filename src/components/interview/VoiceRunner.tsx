"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/auth/FormError";
import { QuestionTimer } from "@/components/interview/QuestionTimer";
import { SaveStatus } from "@/components/interview/SaveStatus";
import { useAnswerQueue } from "@/components/interview/useAnswerQueue";
import { completeSession } from "@/lib/actions/interview";
import {
  useTranscription,
  type TranscriptionProvider,
} from "@/lib/transcription/useTranscription";
import type { RunnerQuestion } from "@/components/interview/InterviewRunner";

interface Props {
  sessionId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<number, string>;
  timerEnabled: boolean;
  timerSeconds: number;
  startIndex: number;
  transcriptionProvider: TranscriptionProvider;
}

/**
 * Voice answering flow (mode = voice). Captures answers by microphone,
 * transcribes via the active provider (Web Speech by default), lets the user
 * edit the transcript, then saves it to BOTH transcript and user_answer so
 * the Phase 8 scorer runs unchanged. Save/advance/finish/resume mirror the
 * text flow (InterviewRunner).
 */
export function VoiceRunner({
  sessionId,
  questions,
  initialAnswers,
  timerEnabled,
  timerSeconds,
  startIndex,
  transcriptionProvider,
}: Props) {
  const total = questions.length;
  const [index, setIndex] = useState(startIndex);
  const [text, setText] = useState(
    initialAnswers[questions[startIndex].position] ?? "",
  );
  const [hasRecorded, setHasRecorded] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string>();

  const { enqueue, flush, unsavedCount, hasFailure } = useAnswerQueue(sessionId);

  const transcription = useTranscription(transcriptionProvider, {
    onTranscript: setText,
  });

  const submitRef = useRef<(auto: boolean) => void>(() => {});
  const startedAtRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Guards against advancing the same question twice (e.g. click + timer).
  const navigatedRef = useRef(false);

  const q = questions[index];
  const isLast = index === total - 1;
  const blocked =
    transcription.status === "denied" || transcription.status === "unsupported";

  function elapsedSeconds(): number {
    const raw = Math.round((Date.now() - startedAtRef.current) / 1000);
    const cap = timerEnabled ? timerSeconds : 100_000;
    return Math.max(0, Math.min(cap, raw));
  }

  function record() {
    transcription.reset();
    setText("");
    setHasRecorded(true);
    void transcription.start();
  }

  async function submit(auto: boolean, overrideText?: string) {
    if (finishing) return;
    if (!isLast && navigatedRef.current) return; // already advanced this one
    if (transcription.recording) transcription.stop();

    const position = q.position;
    const value = overrideText ?? textareaRef.current?.value ?? text;
    const timeTaken = auto ? timerSeconds : elapsedSeconds();

    setError(undefined);

    if (isLast) {
      // Final step: enqueue, then block just long enough to guarantee every
      // answer is saved before scoring runs.
      enqueue(position, { answer: value, timeTaken, transcript: value });
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
      return; // success → redirect
    }

    // Not last: persist in the background and advance instantly.
    navigatedRef.current = true;
    enqueue(position, { answer: value, timeTaken, transcript: value });
    const next = index + 1;
    setHasRecorded(false);
    setText(initialAnswers[questions[next].position] ?? "");
    setIndex(next);
  }

  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    startedAtRef.current = Date.now();
    navigatedRef.current = false;
  }, [index]);

  return (
    <Container className="max-w-2xl py-10">
      {/* Progress */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Question {index + 1} of {total}
          </span>
          <span className="text-[var(--muted-foreground)]">
            {Math.round((index / total) * 100)}% complete
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all"
            style={{ width: `${(index / total) * 100}%` }}
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
              <p className="text-lg font-semibold leading-relaxed">
                {q.questionText}
              </p>

              {/* Mic controls */}
              <div className="flex flex-wrap items-center gap-3">
                {transcription.recording ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                    onClick={() => transcription.stop()}
                  >
                    <Square />
                    Stop recording
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={record}
                    disabled={finishing || blocked}
                  >
                    {hasRecorded ? <RotateCcw /> : <Mic />}
                    {hasRecorded ? "Re-record" : "Record answer"}
                  </Button>
                )}

                {transcription.recording && (
                  <span className="flex items-center gap-2 text-sm text-[var(--destructive)]">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--destructive)] opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--destructive)]" />
                    </span>
                    Listening…
                  </span>
                )}
                {transcription.status === "transcribing" && (
                  <span className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Transcribing…
                  </span>
                )}
              </div>

              {blocked && (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  {transcription.status === "denied"
                    ? "Microphone access was denied."
                    : "Voice input isn't supported in this browser."}{" "}
                  You can type your answer below instead.
                </p>
              )}

              {transcription.status === "error" &&
                !transcription.recording && (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                    Couldn&apos;t reach speech recognition (it needs an internet
                    connection). Type your answer below, or try recording again.
                  </p>
                )}

              {/* Transcript / editable answer (also the typing fallback) */}
              <Textarea
                ref={textareaRef}
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={transcription.recording}
                placeholder={
                  transcription.recording
                    ? "Listening… your words will appear here."
                    : "Your transcript appears here — edit it, or type your answer."
                }
                disabled={finishing}
              />

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
